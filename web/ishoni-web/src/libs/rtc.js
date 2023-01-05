import { userState } from "./user"
import ws from "./ws"
import EventEmitter from 'events';

class rtc extends EventEmitter {


    connectPool = {}

    constructor() {
        super()

        ws.on('Broadcast', this.onBroadcast.bind(this))
    }

    bindConnectPool(pool) {
        this.connectPool = pool
    }

    waitIceComplete(conn) {
        return new Promise((resolve) => {
            if (conn.iceGatheringState == 'complete') {
                resolve()
                return
            }
            const callback = ev => {
                console.debug(`[rtc] Connection state changed to : ${ev.currentTarget.iceGatheringState}`)

                if (ev.currentTarget.iceGatheringState == 'complete') {
                    conn.removeEventListener('icegatheringstatechange', callback)
                    resolve()
                }
            }
            conn.addEventListener('icegatheringstatechange', callback)
        })
    }

    waitConnected(conn) {
        return new Promise((resolve, reject) => {
            if (conn.connectionState == 'connected') {
                resolve()
            } else {
                const callback = ev => {
                    console.warn(`debug--------------- ${conn.connectionState}`,ev)
                    if (conn.connectionState == 'connected') {
                        conn.removeEventListener('connectionstatechange', callback)
                        resolve()
                    }

                    if(conn.connectionState == 'failed'){
                        console.error(ev)
                        reject('Connection failed')
                    }
                }
                conn.addEventListener('connectionstatechange', callback)
            }
        })
    }

    tracks = []
    connected = []

    /**
     * 
     * @returns
     */
    async createConnection() {
        const configuration = {
            iceServers: [
                {
                    urls: [
                        "stun:stun.miwifi.com",
                        "stun:stun3.l.google.com:19302",
                    ],
                }
            ]
        };
        // const configuration  = null

        const localConnection = new RTCPeerConnection(configuration);
        localConnection.onicecandidate = (e) => {
            console.warn('a on ice candidate', e.candidate)
        }

        localConnection.addEventListener('iceconnectionstatechange', ()=>{
            console.warn(`debug iceconnectionstatechange: ${localConnection.iceConnectionState}`)
        })

        const sendChannel = localConnection.createDataChannel("sendChannel");
        localConnection.ondatachannel = event => {
            const receiveChannel = event.channel
            receiveChannel.pc = localConnection
            receiveChannel.onmessage = (event) => {
                this.emit('rtc.message', event)
            }
        }

        localConnection.sendChannel = sendChannel

        // https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/ended_event
        // chrome 远端暂停媒体，不会生成ended事件
        // 可能需要手动创建 ended 事件
        localConnection.ontrack = event => {

            const track = event.track

            console.info(`[rtc] Received a track on ontrack event, track id: ${track.id}`, event)

            this.tracks.push(track)


            track.addEventListener('ended', (ev) => {

                console.error(`[rtc] The track is stopped, it is considered to be removed by the peer ${track.id}`, ev)

                this.emit('rtc.removeTrack', { event: ev, track: track })
            })

            this.emit('rtc.addTrack', event)
        }

        this.connected.push(localConnection)

        return localConnection
    }

    /**
     * 
     * @param {RTCPeerConnection} conn 
     */
    async createOffer(conn) {
        const offer = await conn.createOffer()
        await conn.setLocalDescription(offer)
        await this.waitIceComplete(conn)
        return conn.localDescription
    }


    waitPools = {}

    /**
     * 
     * @param {RTCPeerConnection} conn 
     */
    async connect(conn, reveiveUuid) {
        const queueId = `queue-${userState.uuid}-${reveiveUuid}`
        const offer = await this.createOffer(conn)

        const data = await new Promise((resolve, reject) => {
            this.waitPools[queueId] = [resolve, reject]
            ws.boardcast(JSON.stringify({
                peer: userState.uuid,
                receive: reveiveUuid,
                offer: window.btoa(JSON.stringify(offer)),
                type: 'offer'
            }))

            setTimeout(() => {
                this.failQueue()
            }, 1000 * 20);
        })

        const answer = JSON.parse(window.atob(data.answer))
        await conn.setRemoteDescription(new RTCSessionDescription(answer))
        await this.waitConnected(conn)
        return conn
    }

    /**
     * 
     * @param {Object} offer jsonData
     */
    async answerConnect(jsonData) {
        const offerDesc = JSON.parse(window.atob(jsonData.offer))

        let conn = null
        if (this.connectPool[jsonData.peer]) { //  && conn.connectionState == 'connected'  // 如果需要再加
            conn = this.connectPool[jsonData.peer]
        } else {
            conn = await this.createConnection()
        }


        await conn.setRemoteDescription(new RTCSessionDescription(offerDesc))

        const answer = await conn.createAnswer()

        await conn.setLocalDescription(answer)

        await this.waitIceComplete(conn)

        ws.boardcast(JSON.stringify({
            peer: userState.uuid,
            receive: jsonData.peer,
            answer: window.btoa(JSON.stringify(conn.localDescription)),
            type: 'answer'
        }))

        this.emit('rtc.answerConnect', conn, jsonData.peer) // 得到一个新连接
    }

    failQueue(queueId) {
        if (this.waitPools[queueId]) {
            const [resolve, reject] = this.waitPools[queueId]
            delete this.waitPools[queueId]
            reject()
        }
    }

    succQueue(queueId, data) {
        if (this.waitPools[queueId]) {
            const [resolve, reject] = this.waitPools[queueId]
            delete this.waitPools[queueId]
            resolve(data)
        }
    }

    onBroadcast(result) {
        // on websocket broad cast
        const jsonData = JSON.parse(result.data)

        console.info(`[rtc] Received a broadcast message from websocket`, jsonData)

        if (jsonData.type == 'offer' && jsonData.receive == userState.uuid) {
            this.answerConnect(jsonData)
        } else if (jsonData.type == 'answer' && jsonData.receive == userState.uuid) {
            const queueId = `queue-${userState.uuid}-${jsonData.peer}`
            this.succQueue(queueId, jsonData)
        } else if (jsonData.type == 'track:stop') {
            let track = this.tracks.find(i => i.id == jsonData.id)
            track && track.dispatchEvent(new Event('ended'))
        } else if (jsonData.type == 'transceiver:stop' && jsonData.uuid == userState.uuid) {

            this.emit('rtc.transceiver:stop', {
                mid: jsonData.id,
                peer: jsonData.peer
            })
        }
    }

    async upgradeOffer({ conn, uuid, streams }) {

        if (Array.isArray(streams)) {
            // let idleSenders = conn.getSenders().filter(i => i.track == null && i.transport.state == "connected")

            const senders = conn.getSenders()
            let existsId = senders ? senders.filter(i => i.track).map(i => i.track.id) : []
            streams.forEach(stream => {
                // 可能要判断 track.kind 一致才能替换

                stream.getTracks().forEach(track => {

                    if (existsId.indexOf(track.id) == -1) {
                        conn.addTrack(track)
                    } else {
                        console.warn(`[rtc] [${uuid}] The Sender of the peer connection already has pusher track,don't add it anymore ${track.id}`)
                    }

                })

                // 暂时不考虑替换 track，如果要替换track，接收端就不能产生ended 事件，否则会收不到数据

                // stream.getTracks().forEach(track => {

                //     let senders = conn.getSenders()
                //     let replaced =  false
                //     for(let i in senders){
                //         if(senders[i].track.enabled && senders[i].track.readyState == 'ended'){
                //             senders[i].replaceTrack(track)
                //             replaced = true
                //         }
                //     }
                //     if(!replaced){
                //         conn.addTrack(track)
                //     }
                // }) 

            })
        }

        console.info(`[rtc] [${uuid}] Will be created Offer`)

        const offer = await this.createOffer(conn)

        console.info(`[rtc] [${uuid}] The offer that has been created`, offer)

        // debugger
        const data = await new Promise((resolve, reject) => {
            const queueId = `queue-${userState.uuid}-${uuid}`
            this.waitPools[queueId] = [resolve, reject]
            ws.boardcast(JSON.stringify({
                peer: userState.uuid,
                receive: uuid,
                offer: window.btoa(JSON.stringify(offer)),
                type: 'offer'
            }))

            setTimeout(() => {
                this.failQueue()
            }, 1000 * 20);
        })

        console.info(`[rtc] [${uuid}] Got the answer for the offer`, data)

        const answer = JSON.parse(window.atob(data.answer))
        console.info(`[rtc] [${uuid}] Will be setRemoteDescription`, answer)

        await conn.setRemoteDescription(new RTCSessionDescription(answer))

        console.info(`[rtc] [${uuid}] Waiting for connection to peer`)

        await this.waitConnected(conn)

        console.info(`[rtc] [${uuid}] Successfully connected to peer`)

        return conn
    }
}
export default new rtc