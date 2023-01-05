
import { reactive } from 'vue'
import ws from './ws'

function getUuid() {
    return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

let uuid = localStorage.getItem('uuid')
let user_name = localStorage.getItem('user_name')
if (!uuid) {
    uuid = getUuid()
    localStorage.setItem('uuid', uuid)
}

export const userState = reactive({
    uuid: uuid,
    name: user_name,

    saveName() {
        localStorage.setItem('user_name', this.name)

        ws.changeName(userState.name)
    },
})