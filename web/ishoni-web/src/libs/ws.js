import EventEmitter from 'events';

const SERVER_URL = import.meta.env.VITE_SERVER_URL
class ws extends EventEmitter {

    id = 0

    request = {}

    socket = null

    constructor() {
        super()

        console.info(`[ws] Reigster event on ws constructor`)

        this.on('register', this.onRegister.bind(this))
        this.on('createRoom', this.createRoom.bind(this))
        this.on('message', this.message.bind(this))
    }

    /**
     * 注册事件,解决别的依赖 ws 问题
     * 如：ws先连接，room模块还没注册事件导致，ws分发事件时，room捕获不到。
     */
    onRegister(name) {
        if (name == 'room') {
            this.connect()
        }
    }

    getUuid() {
        return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0,
                v = c == 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    connect() {
        let uuid = localStorage.getItem('uuid')
        if (!uuid) {
            uuid = this.getUuid()
            localStorage.setItem('uuid', uuid)
        }
        const socket = new WebSocket(SERVER_URL + '/ws?uuid=' + uuid)


        socket.addEventListener('open', (event) => {
            this.emit('open', event)
            console.info(`[ws] Connected to server`, event)
        })

        socket.addEventListener('close', (event) => {
            console.info(`[ws] Websocket is closed`, event)
            setTimeout(() => {
                this.connect()
            }, 3000);
        })

        socket.addEventListener('message', (event) => {
            this.emit('message', event)
            console.info(`[ws] Message from server `, event)
        });

        this.socket = socket
        return socket
    }

    ready(callback) {
        if (this.socket && this.socket.readyState == WebSocket.OPEN) {
            callback()
        } else {
            this.once('open', callback)
        }
    }

    message(event) {
        const messages = event.data.split("\n")
        messages.forEach(element => {
            this.handleMessage(element)
        });



    }

    handleMessage(text) {
        const data = JSON.parse(text)
        const call = this.request[data.id]
        if (call) {
            delete this.request[data.id]
            call[0](data)
        }
        console.info(`[ws] HandleMessage ${data.command}`)

        if (data.command == "UpdateName") {
            this.emit('UpdateName', data)
        }

        if (data.command == "MembersUpdate") {
            this.emit('MembersUpdate', data)
        }

        if (data.command == "MembersLeave") {
            this.emit('MembersLeave', data)
        }

        if (data.command == "Broadcast") {
            this.emit('Broadcast', data)
        }
    }

    createRoom(roomId) {
        const id = ++this.id
        return new Promise((resolve, reject) => {
            this.request[id] = [resolve, reject]
            this.socket.send(JSON.stringify({
                id: id.toString(),
                command: 'CreateRoom',
                data: roomId
            }))
        })
    }

    getRoom() {
        const id = ++this.id
        return new Promise((resolve, reject) => {
            this.request[id] = [resolve, reject]
            this.socket.send(JSON.stringify({
                id: id.toString(),
                command: 'GetRooms',
                data: ""
            }))
        })
    }


    changeName(name) {
        const id = ++this.id
        return new Promise((resolve, reject) => {
            this.request[id] = [resolve, reject]
            this.socket.send(JSON.stringify({
                id: id.toString(),
                command: 'UpdateName',
                data: name
            }))
        })
    }

    joinRoom(roomId) {
        const id = ++this.id
        return new Promise((resolve, reject) => {
            this.request[id] = [resolve, reject]
            this.socket.send(JSON.stringify({
                id: id.toString(),
                command: 'JoinRoom',
                data: roomId
            }))
        })
    }


    boardcast(text) {
        const id = ++this.id
        this.socket.send(JSON.stringify({
            id: id.toString(),
            command: 'BroadcastMessage',
            data: text
        }))
    }
}
export default new ws