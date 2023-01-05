<template>
    <div class="container">
        <div class="panel">
            <p class="title">YOU CAN</p>
            <button class="btn" @click="createRoom">CREATE ROOMS</button>
        </div>
    </div>
</template>

<script setup>
import ws from "../libs/ws"
import { useRouter } from 'vue-router'
import room from "../libs/room";
console.log(window.room = room)
// consoo
const router = useRouter()
function createRoom() {
    const randRoomId = Math.random().toString().substr(2, 4)
    ws.createRoom(randRoomId).then(data => {
        if (data.code == 200) {
            localStorage.setItem('room_id', randRoomId)
            router.push({ name: "room", params: { id: randRoomId } })
        } else {
            console.log(data.message)
        }
    })
}
window.dd = ws
</script>

<style lang="scss" scoped>
.btn {
    margin-left: 1rem;
    padding: 8px;
    background-color: #ffc0cb;
    color: #fff;
    border: solid 1px #fff;
    transition: all 0.2s ease-in-out;
    box-shadow: #ffc0cb 2px 2px 5px;
}

.btn:hover {
    box-shadow: #ffc0cb 2px 4px 15px;
}

.container {
    position: absolute;
    -webkit-transform: translate(-50%, -50%);
    transform: translate(-50%, -50%);
    top: 50%;
    left: 50%;

    // width: 80%;
    // max-width: 800px;
    // height: 50%;
    display: block;
}

.panel {
    background: rgba(255, 255, 255, 0.3);
    padding: 3em;
    border-radius: 20px;
    border-left: 1px solid rgba(255, 255, 255, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    box-shadow: 20px 20px 40px -6px rgba(0, 0, 0, 0.2);
    text-align: center;
    position: relative;
    -webkit-transition: all 0.2s ease-in-out;
    transition: all 0.2s ease-in-out;

    display: flex;
    flex-direction: row;

    height: 100%;

    p {
        font-weight: bolder;
        color: pink;
        font-size: 1.4rem;
        margin-top: 0;
    }
}
</style>