import EventEmitter from 'events';
import { reactive, watch } from 'vue'
import { waitClicked } from './common';
import rtc from './rtc';
import { userState } from './user';
import ws from './ws';


const speacker = new Audio()
// speacker.src='http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
let initMuted = false
speacker.addEventListener('canplay', () => {
    waitClicked().then(() => {
        speacker.play()
        if (!initMuted) {
            roomState.roomMuted = false// 只自动解除一次静音
            initMuted = true
        }
    })
})


window.speacker = speacker

const RoomState = {
    members: [],
    id: '',

    dataChannel: true,
    audioChannel: false,
    videoChannel: false,
    displayChannel: false,

    tracks: [],
    userTracks: {

    },


    /**
     * @var {RTCPeerConnection[]}
     */
    peerPools: {},

    publicMessages: `[system] Support drag and drop files\n`,

    /**
     * 这是为了保证先建立的语音会话，后连进来的人的连接没有语音 stream, 而通过此version判断连接的version是否一致，不一致则升级连接。
     */
    version: 1,
    versionLock: false,
    saveStream: [],

    outboundStreams: [],
    inboundStreams: [],//暂时未重写
    allStreams: [],
    allAudioTracks: [],

    singlePreviewId: '',

    roomMuted: true,
    roomScreenShared: false,
    roomVideoEnabled: false,
    roomMicrophoneEnabled: false,
}

export const roomState = reactive(RoomState)


window.roomState = roomState
window.rtc = rtc

class StreamManager extends EventEmitter {

    streams = []

    constructor(streams) {
        super()
        this.streams = streams
    }

    /**
     * 
     * @param {MediaStream} stream 
     * @param {string} tag 
     */
    addStream(stream, tag) {
        stream.tag = tag
        stream.show = true // 为页面判断显示埋点
        stream.getTracks().forEach(track => track.addEventListener('ended', () => {
            console.warn(`[room] Screen sharing is interrupted ${track.id}`)
            this.removeStreamByID(stream.id)
            this.emit(`${tag}.stop`, stream)
        }))
        this.streams.push(stream)
    }

    /**
     * 
     * @param {string} id 
     */
    removeStreamByID(id) {
        let deleted = []

        this.streams.find(i => i.id == id).getTracks().forEach(track => deleted.push(track))

        const index = this.streams.findIndex(i => i.id == id)
        if (index > -1) {
            this.streams.splice(index, 1)
        }

        deleted.forEach(track => this.stopTrack(track))
    }

    /**
     * 一般情况下一个 tag 只有一个流
     * @param {string} tag 
     */
    removeStreamByTag(tag) {
        let deleted = []
        this.streams.find(i => i.tag == tag).getTracks().forEach(track => deleted.push(track))

        const index = this.streams.findIndex(i => i.tag == tag)
        if (index > -1) {
            this.streams.splice(index, 1)
        }

        deleted.forEach(track => this.stopTrack(track))
    }

    removeStreamByTrackID(id) {
        let deleted = []
        let index = -1

        this.streams.forEach((stream, _index) => {
            let track = stream.getTracks().find(i => i.id == id)
            if (track) {
                deleted.push(track)
                index = _index
            }
        })

        if (index > -1) {
            this.streams.splice(index, 1)
        }

        deleted.forEach(track => this.stopTrack(track))
    }

    stopTrack(track) {
        track.stop()
        this.emit('track.stop', track)
    }
}

export const outBoundstreamManager = new StreamManager(roomState.outboundStreams)
export const inBoundstreamManager = new StreamManager(roomState.inboundStreams)

watch(roomState.inboundStreams, () => {
    roomState.allStreams.splice(0, roomState.allStreams.length)
    roomState.allAudioTracks.splice(0, roomState.allAudioTracks.length)

    roomState.inboundStreams.concat(roomState.outboundStreams).forEach(i => {
        if (i.getVideoTracks().length > 0) {
            roomState.allStreams.push(i)
        }
    })

    roomState.inboundStreams.forEach(i => {
        i.getAudioTracks().forEach(t => {
            roomState.allAudioTracks.push(t)
        })
    })
})
watch(roomState.outboundStreams, () => {
    roomState.allStreams.splice(0, roomState.allStreams.length)
    roomState.allAudioTracks.splice(0, roomState.allAudioTracks.length)

    roomState.inboundStreams.concat(roomState.outboundStreams).forEach(i => {
        if (i.getVideoTracks().length > 0) {
            roomState.allStreams.push(i)
        }
    })

    roomState.inboundStreams.forEach(i => {
        i.getAudioTracks().forEach(t => {
            roomState.allAudioTracks.push(t)
        })
    })
})

watch(roomState.allAudioTracks, () => {
    const stream = new MediaStream(roomState.allAudioTracks)
    speacker.srcObject = stream

    console.info(`[room] watch event: The audio track of stream has already changed`, stream)
})

class room extends EventEmitter {

    constructor() {
        super()
        // clean up the room
        roomState.members = []
        roomState.peerPools = {}

        console.info('[room] Reigster event on room constructor')

        ws.on('MembersUpdate', this.handleMembersUpdate.bind(this))

        ws.on('UpdateName', this.handleChangeName.bind(this))

        ws.on('MembersLeave', this.handleMemberLeave.bind(this))

        rtc.on('rtc.message', this.handleReceiveMessage.bind(this))

        rtc.on('rtc.answerConnect', this.receivePeerConnect.bind(this))
        rtc.on('rtc.addTrack', this.addTrack.bind(this))
        rtc.on('rtc.removeTrack', this.removeTrack.bind(this))
        rtc.on('rtc.transceiver:stop', this.transceiverStop.bind(this))

        rtc.bindConnectPool(roomState.peerPools)

        this.on('joinMember', this.createConnectForMember.bind(this))
        this.on('leaveMember', this.closeConnect.bind(this))


        outBoundstreamManager.on('track.stop', (track) => {
            console.info(`[room] The track has stopped, and will be closed ${track.id}`, track)

            this.closeTrack(track.id)
        })

        window.ws = ws

        ws.emit('register', 'room')
    }

    transceiverStop({ mid, peer }) {
        if (roomState.peerPools[peer]) {
            let transceivers = roomState.peerPools[peer].getTransceivers()
            for (let i in transceivers) {
                if (transceivers[i].mid == mid) {
                    transceivers[i].receiver.track.dispatchEvent(new Event('ended'));
                }
            }
        }
    }

    removeTrack({ event, track }) {
        console.log(track)

        // 因为流管理会自动删除，这里不用再次触发
        // inBoundstreamManager.removeStreamByTrackID(track.id)
    }

    addTrack(event) {
        const track = event.track
        // let existsTrack = roomState.tracks.find(i => i.id == track.id)
        // if (existsTrack) {
        //     console.log(`[room.addTrack] update exists track ${track.id}`)
        //     existsTrack = track
        // } else {
        //     console.log(`[room.addTrack] add a track ${track.id}`)
        //     // 到时候按照用户存 track : uuid =>[track...]
        //     roomState.tracks.push(track)

        //     if (!roomState.userTracks[event.target.uuid]) {
        //         const audioEle = new Audio()
        //         audioEle.muted = roomState.roomMuted
        //         audioEle.autoplay = true
        //         audioEle.oncanplay = (obj) => {
        //             console.log('能播放了???????????????', obj)
        //         }
        //         roomState.userTracks[event.target.uuid] = {
        //             show: true,
        //             audioSream: new MediaStream(),
        //             videoStream: new MediaStream(),
        //             audio: audioEle,  // 声音需要背景播放需要创建对象，视频不需要建立
        //         }
        //     }


        //     if (track.kind == 'audio') {
        //         console.log('-------------------------------------------')
        //         roomState.userTracks[event.target.uuid].audioSream.addTrack(track)
        //         roomState.userTracks[event.target.uuid].audio.srcObject = roomState.userTracks[event.target.uuid].audioSream
        //         console.log('=====', roomState.userTracks[event.target.uuid].audio.muted, roomState.roomMuted)
        //         waitClicked().then(() => roomState.userTracks[event.target.uuid].audio.play())
        //     } else if (track.kind == 'video') {
        //         roomState.userTracks[event.target.uuid].videoStream.addTrack(track)
        //     }




        // }


        const stream = new MediaStream([track])
        const uuidTag = event.target.uuid
        inBoundstreamManager.addStream(stream, uuidTag)


        this.emit('updateTrack', roomState.tracks)
    }


    receiveDataQueue = {

    }

    handleReceiveMessage(event) {
        const uuid = event.target.pc.uuid

        if (event.data instanceof ArrayBuffer) {
            console.warn(`[room] Receive a message ArrayBuffer bytes: ${event.data.byteLength}`)

            if (this.receiveDataQueue[uuid]) {
                this.receiveDataQueue[uuid].bytes.push(event.data)
                this.receiveDataQueue[uuid].receivedBytes += event.data.byteLength

                if (this.receiveDataQueue[uuid].receivedBytes == this.receiveDataQueue[uuid].head.size) {

                    const head = this.receiveDataQueue[uuid].head
                    const file = new File(this.receiveDataQueue[uuid].bytes,
                        head.name,
                        {
                            type: head.type,
                            lastModified: head.lastModified
                        })

                    const url = URL.createObjectURL(file)

                    const receiveMember = roomState.members.find(i => i.uuid == uuid)
                    const memberName = receiveMember ? receiveMember.name : uuid
                    roomState.publicMessages += `${memberName}: Received a file: ${url}  name: ${file.name},  size: ${file.size}\n`


                    console.info(`[room] Received a file:  ${url}`)

                    delete this.receiveDataQueue[uuid]
                }
            } else {
                console.error(`[room] The packets without headers are ignored, uuid ${uuid}`)
            }
        } else {
            console.info(`[room] Receive new message: ${event.data}`)
            const payload = JSON.parse(event.data)
            if (payload.type == 'sendMessage') {
                roomState.publicMessages += payload.data
            } else if (payload.type == 'sendFile') {

                if (!this.receiveDataQueue[uuid]) {
                    this.receiveDataQueue[uuid] = {
                        head: payload.file,
                        receivedBytes: 0,
                        bytes: []
                    }
                }
            } else {
                console.error(`[room] Unimplemented broadcast type: ${payload.type}`, payload)
            }
        }


    }

    handleChangeName(data) {

        console.info(`[room] The Member name is chagned to ${data.data} by id ${data.id}`)
        this.updateName(data.id, data.data)
    }

    handleMemberLeave(data) {
        this.leaveMember(data.id)
    }

    async handleMembersUpdate() {
        const result = await ws.getRoom()
        if (result.code == 200) {
            const newMembers = result.members
            newMembers.forEach(newMember => this.joinMember(newMember));
        } else {
            console.error(`[room] Error on getRoom: ${result.message}`)
        }
    }

    updateName(uuid, name) {
        let member = roomState.members.find(i => i.uuid == uuid)
        if (member) {
            member.name = name
        }
    }

    updateActive(uuid, active) {
        let member = roomState.members.find(i => i.uuid == uuid)
        if (member) {
            member.active = active
        }
    }

    joinMember(newMember) {
        const exists = roomState.members.map(i => i.uuid)
        if (exists.indexOf(newMember.uuid) == -1) {
            newMember.active = 0
            roomState.members.push(newMember)
            this.emit('joinMember', newMember)
        }
    }

    leaveMember(uuid) {
        const exists = roomState.members.map(i => i.uuid)
        if (exists.indexOf(uuid) > -1) {
            roomState.members = roomState.members.filter(i => i.uuid !== uuid)

            this.emit('leaveMember', uuid)
        }
    }

    setId(id) {
        roomState.id = id
    }

    setMuted() {
        roomState.roomMuted = !roomState.roomMuted
        for (let i in roomState.allAudioTracks) {
            roomState.allAudioTracks[i].enabled = !roomState.roomMuted
        }
    }

    mergeUnique(objectOfArray1, objectOfArray2, uniqueField) {
        let uniqueIds = []

        let a3 = objectOfArray1.concat(objectOfArray2).filter(i => {
            const id = i[uniqueField]
            if (uniqueIds.indexOf(id) != -1) {
                return false
            }
            uniqueIds.push(id)
            return true
        })

        return a3
    }

    async chooseConnectionUpgrade({ conn, uuid, streams }) {
        await rtc.upgradeOffer({
            conn: conn,
            uuid: uuid,
            streams: streams
        })
    }

    async upgradeConnect() {
        if (roomState.versionLock) {
            throw Error('The upgrade is in progress, please try again later!')
        }
        roomState.versionLock = true
        roomState.version++;

        for (let i in roomState.peerPools) {
            const receiveUuid = i
            const peer = roomState.peerPools[i]

            if (userState.uuid == receiveUuid) {
                continue
            }

            if (peer.version == roomState.version) {
                continue
            }


            // 任意一端都可以升级，所以不限制发起者
            // const offerUuid = this.negotiatePriorityOffer(receiveUuid ,userState.uuid)
            // if(offerUuid != userState.uuid){
            //     continue
            // }




            console.info(`[room] Will be upgrade connect for ${receiveUuid}`)

            this.chooseConnectionUpgrade({
                conn: peer,
                uuid: receiveUuid,
                streams: roomState.outboundStreams
            })

            peer.version = roomState.version
        }
        roomState.versionLock = false
    }

    async sendPublicMessage(text) {
        console.info(`[room] You send a new message: ${text}`)

        const msg = `${userState.name}: ${text}\n`
        roomState.publicMessages += msg

        await this.boardcast({ type: 'text', data: msg })
    }

    negotiatePriorityOffer(uuid, uuid2) {
        const uuidArr = [uuid, uuid2]
        uuidArr.sort()
        return uuidArr.shift()

    }

    async createConnectForMember(member) {
        if (userState.uuid == member.uuid) {
            return
        }

        const offerUuid = this.negotiatePriorityOffer(member.uuid, userState.uuid)
        if (offerUuid != userState.uuid) {
            return
        }

        console.info(`[room] Open a connection for : ${member.uuid}`)

        const uuid = member.uuid
        if (!roomState.peerPools[uuid]) {
            const pc = await rtc.createConnection()
            pc.uuid = uuid
            pc.version = roomState.version

            roomState.outboundStreams.forEach(stream => {
                pc.addStream(stream)
            });

            roomState.peerPools[uuid] = pc
            await rtc.connect(pc, uuid)
            this.updateActive(uuid, 1)
        }
    }


    async closeConnect(uuid) {
        console.info(`[room] Close a connection for : ${uuid}`)
        if (roomState.peerPools[uuid]) {
            const conn = roomState.peerPools[uuid]
            delete roomState.peerPools[uuid]
            delete roomState.userTracks[uuid]
            conn.close()
        }
    }

    async receivePeerConnect(conn, uuid) {
        let upgradeConnect = false
        if (roomState.peerPools[uuid]) {
            console.warn(`[room] A conenct will be replaced for ${uuid}`)
        } else {
            // 尝试只升级一次
            // 连接池里不存在的则认为是首次建立建立
            upgradeConnect = true
        }

        console.warn(`[room] ${uuid} Wait for the answer to be confirmed to connect`)
        await rtc.waitConnected(conn)
        console.warn(`[room] ${uuid} Connection confirmed successfully`)

        conn.version = roomState.version
        conn.uuid = uuid
        roomState.peerPools[uuid] = conn
        // debugger

        // 一直标绿的原因，得到了连接，继续升级失败导致还是绿色的
        this.updateActive(uuid, 1)

        // upgradeConnect = false // debug
        if (upgradeConnect) {
            // this.upgradeConnect(roomState.saveStream)

            console.warn(`[room] Try to upgrade only one connection for received a connection ${uuid}`)

            this.chooseConnectionUpgrade({
                conn: conn,
                uuid: uuid,
                streams: roomState.outboundStreams
            })
        }

        // 得到新连接之后就升级流
        // console.log(`可能要去升级流?`)
        // this.upgradeConnect(roomState.saveStream)
    }

    closeTrack(trackId) {

        for (let uuid in roomState.peerPools) {
            const transceivers = roomState.peerPools[uuid].getTransceivers()
            for (let i2 in transceivers) {
                if (transceivers[i2].sender.track && transceivers[i2].sender.track.id == trackId) {
                    ws.boardcast(JSON.stringify({
                        type: 'transceiver:stop',
                        id: transceivers[i2].mid,
                        uuid: uuid,
                        peer: userState.uuid
                    }))
                }
            }
        }
    }

    fileToArrayBuffer(file) {
        return new Promise((resolve) => {
            var reader = new FileReader();
            reader.addEventListener('load', (event) => {
                resolve(event.target.result)
            });
            reader.readAsArrayBuffer(file);
        });
    }

    boardcastData(data) {
        for (let i in roomState.peerPools) {
            roomState.peerPools[i].sendChannel.send(data)
        }
    }


    async boardcast({ type, data }) {
        if (type == 'text') {
            console.info(`[room] Boardcast a message for all peer connection`, data)

            this.boardcastData(JSON.stringify({
                type: 'sendMessage',
                data: data
            }))
        } else if (type == 'file' && data instanceof File) {
            console.info(`[rtc] Boardcast a message for all peer connection`, data)

            const fileArrayBuffer = await this.fileToArrayBuffer(data)
            const maxLength = 1024 * 64;
            let size = 0;
            let offset = 0;


            this.boardcastData(JSON.stringify({
                type: 'sendFile',
                file: {
                    name: data.name,
                    size: data.size,
                    type: data.type,
                    lastModified: data.lastModified,
                }
            }))
            while (size < fileArrayBuffer.byteLength) {
                const length = fileArrayBuffer.byteLength - offset >= maxLength ? maxLength : fileArrayBuffer.byteLength - offset;

                const dv = new DataView(fileArrayBuffer, offset, length);

                console.info(`[rtc] chunk offset:${offset} length: ${length}`, dv)
                offset += length
                size += length

                this.boardcastData(dv)
            }
        } else {
            console.error(`[rtc] boardcast type ${type} is Not supported!`)
        }

    }

}
export default new room