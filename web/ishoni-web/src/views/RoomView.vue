<script>
import ws from '../libs/ws'

import room from "../libs/room";
import { roomState, outBoundstreamManager, inBoundstreamManager } from "../libs/room";
import { userState } from "../libs/user";
window.room = room
window.userState = userState
window.outBoundstreamManager = outBoundstreamManager
window.inBoundstreamManager = inBoundstreamManager


export default {
    data() {
        return {
            microphone: false,
            videoLive: false,
            textHistory: false,

            inputMessage: '',

            devices: {
                audioinput: [],
                audiooutput: [],
                videoinput: [],
            },

            // test
            videoStream: [
                {
                    id: '1',
                    show: true
                },
                {
                    id: '2',
                    show: true
                },
                {
                    id: '3',
                    show: true
                },
                {
                    id: '4',
                    show: true
                },
                {
                    id: '5',
                    show: true
                },
            ],
            videoShowSingle: false,

            roomId: 0,


            roomState,
            userState,
        }
    },
    methods: {
        async drop(event) {
            event.preventDefault()
            event.stopPropagation();
            for (const [key, file] of Object.entries(event.dataTransfer.files)) {
                await room.sendPublicMessage(`Send a file: ${file.name}`)
                await room.boardcast({
                    type: 'file',
                    data: file
                })
            }
        },
        async toggleMicrophone() {

            try {

                const tag = 'audio'
                if (roomState.roomMicrophoneEnabled) {
                    outBoundstreamManager.removeStreamByTag(tag)
                } else {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

                    outBoundstreamManager.addStream(stream, tag)
                    outBoundstreamManager.once(`${tag}.stop`, () => {
                        roomState.roomMicrophoneEnabled = false
                    })

                    room.upgradeConnect()
                }

                roomState.roomMicrophoneEnabled = !roomState.roomMicrophoneEnabled
            } catch (e) {
                roomState.roomMicrophoneEnabled = false
                throw e
            }
        },
        async toggleVideoLive() {
            try {

                const tag = 'video'
                if (roomState.roomVideoEnabled) {
                    outBoundstreamManager.removeStreamByTag(tag)
                } else {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true })

                    outBoundstreamManager.addStream(stream, tag)
                    outBoundstreamManager.once(`${tag}.stop`, () => {
                        roomState.roomVideoEnabled = false
                    })

                    room.upgradeConnect()
                }

                roomState.roomVideoEnabled = !roomState.roomVideoEnabled
            } catch (e) {
                roomState.roomVideoEnabled = false
                throw e
            }
        },
        async screenShare() {
            const tag = 'screen'
            try {
                if (roomState.roomScreenShared) {
                    outBoundstreamManager.removeStreamByTag(tag)
                } else {
                    const stream = await navigator.mediaDevices.getDisplayMedia()

                    outBoundstreamManager.addStream(stream, tag)
                    outBoundstreamManager.once(`${tag}.stop`, () => {
                        roomState.roomScreenShared = false
                    })

                    room.upgradeConnect()
                }
                roomState.roomScreenShared = !roomState.roomScreenShared
            } catch (e) {
                throw e
            }
        },
        toggleTextHistory() {
            this.textHistory = !this.textHistory
        },
        sendMessage() {
            room.sendPublicMessage(this.inputMessage)
            this.inputMessage = ''
        },
        inputMessageKeyUp(e) {
            if (e.code == 'Enter' || e.code == 'NumpadEnter') {
                +this.inputMessage != "" && this.sendMessage()
                e.preventDefault();
            }
        },

        setMuted() {
            room.setMuted()
        },

        canPlay(obj) {
            console.info(`[room.page] can play ? ${obj.readyState}`, obj)
            if (obj.currentTarget) {
                obj.currentTarget.play()
                console.info('Already trigger a play event')
            }
        },

        toggleMedia(stream) {

            this.videoShowSingle = !this.videoShowSingle

            if (this.videoShowSingle) {
                roomState.singlePreviewId = stream.id
            } else {
                roomState.singlePreviewId = ''
            }
        },
        async onOpen() {
            this.roomId = this.$route.params.id
            console.info(`[room.page] The room id is ${this.roomId}`)

            const result = await ws.joinRoom(this.roomId)

            if (result.code != 200) {
                return this.$router.push({ name: 'create-room' })
            }

            if (userState.name) {
                userState.saveName()
            }

            // fetch members
            room.handleMembersUpdate()
        },
    },
    mounted() {
        ws.ready(this.onOpen)
        window.view = this
    },

}
</script>

<template>

    <div class="container">
        <div class="panel">

            <div id="setting-btn" @click="$router.push({ name: 'setting' })"></div>

            <div class="main-content">
                <p class="title">The Room #{{ this.roomId }}</p>

                <textarea @drop.prevent="drop" @dragenter.prevent @dragover.prevent class="main-text-histories" name=""
                    id="" cols="30" rows="10" v-if="textHistory" v-text="roomState.publicMessages" readonly></textarea>

                <div class="main-video-wapper" v-else>

                    <!-- <div class="main-video"  v-for="stream in videoStream"  @click.prevent="toggleMedia(stream)"  v-show="stream.show == true">
                        <video  autoplay src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"   controls="controls" muted="muted" @canplay="canPlay($event)"
                        
                            :data="stream.show">
                        </video>
                    </div> -->


                    <div class="main-video" v-for="userStream in roomState.allStreams"
                        @click.prevent="toggleMedia(userStream)"
                        v-show="roomState.singlePreviewId ? (roomState.singlePreviewId && userStream.id == roomState.singlePreviewId) : true">
                        <video poster="/public/loading.gif" controls="controls" muted="muted" @canplay="canPlay($event)"
                            :id="'main-video' + userStream.id" autoplay :srcObject="userStream" :data="userStream.show">
                        </video>
                    </div>

                </div>
                <div class="input-control">

                    <div id="mirophone-btn" class="microphone-btn" :class="{ block: !roomState.roomMicrophoneEnabled }"
                        @click="toggleMicrophone"></div>


                    <div id="video-live-btn" class="video-live-btn" :class="{ block: !roomState.roomVideoEnabled }"
                        @click="toggleVideoLive"></div>



                    <div id="screen-share-btn" class="screen-share" :class="{ block: !roomState.roomScreenShared }"
                        @click="screenShare"></div>

                    <div id="audio-btn" class="speaker" :class="{ muted: roomState.roomMuted }" @click="setMuted"></div>

                    <div class="send-message-block">
                        <div class="message-histories-btn" @click="toggleTextHistory"></div>
                        <label style="user-select: none;">message: </label>
                        <input class="message-send-input" type="text" v-model="inputMessage" @keyup="inputMessageKeyUp">
                        <button class="message-send-btn" @click="sendMessage">send</button>
                    </div>
                </div>
            </div>
            <div class="room-control">
                <p class="title">Members</p>
                <ul class="members">
                    <li class="" :title="member.name + member.uuid == userState.uuid ? '(me)' : ''"
                        :class="{ active: member.active, loading: !member.active && member.uuid != userState.uuid, star: member.active || member.uuid == userState.uuid, me: member.uuid == userState.uuid }"
                        v-for="member in roomState.members">
                        {{ member.name }} {{ member.uuid == userState.uuid ? '(me)' : '' }}</li>
                </ul>
            </div>
        </div>
    </div>


</template>
 
<style lang="scss" scoped>
.container {
    position: absolute;
    -webkit-transform: translate(-50%, -50%);
    transform: translate(-50%, -50%);
    top: 50%;
    left: 50%;

    width: 80%;
    max-width: 1360px;
    height: 50%;
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

    .title {
        margin-bottom: 1rem;
    }
}

#setting-btn {
    width: 32px;
    height: 32px;
    background: url(@/assets/img/settings-32.png);
    transition: all 0.2s ease-in-out;

    position: absolute;
    right: 2rem;
    top: 1rem;
}

#setting-btn:hover {
    width: 35px;
    height: 35px;
}

.main-content {
    flex: 1;
    height: 100%;
}

.room-control {
    flex: 0.2;
    height: 100%;

}


.main-text-histories {
    width: 100%;
    height: 500px;
}

.main-text-histories:focus {
    outline: none !important;
    border: 1px solid red;
    box-shadow: 0 0 10px #719ECE;
}


.main-video-wapper {
    position: relative;
    display: inline-flex;
    // flex-flow: column wrap;
    // align-content: flex-start;
    flex-direction: row;
    width: 100%;
    // height: 500px;
    height: 86%;

    position: relative;
    display: inline-flex;
    /* flex-flow: column wrap; */
    overflow: hidden;

    overflow: hidden;

    .main-video {
        background: #1f1f1f;
        max-width: 100%;
        flex: 1;
        border: solid 1px pink;

        video {
            width: 100%;
            height: 100%;
        }
    }

    .main-video-loading {
        display: inline-block;
        position: absolute;
        left: 0;
        top: 0;
        background-image: url(@/assets/img/loading.gif);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 71px 97px;
        ;
        z-index: 9;
        width: 100%;
        height: 100%;
    }
}


.members {
    list-style: none;
    padding: 0px 10px;
    text-align: left;

    overflow: hidden;
    height: 100%;
    overflow: hidden;


    li {
        padding: 4px 8px 4px 30px;
        position: relative;

        white-space: nowrap;
        overflow: hidden;
        width: 200px;

        user-select: none;
    }

    li:hover {
        color: #fff;
        background-color: rgb(76, 180, 108);
        cursor: pointer;
    }
    
    li.audio::before {
        content: " ";
        position: absolute;
        top: 0;
        left: 0;
        background: url(@/assets/img/sound/audio-50.png) no-repeat center center/100%;
        width: 24px;
        height: 29px;
    }

    li.audio.muted::before {
        background: url(@/assets/img/sound/no-audio-50.png) no-repeat center center/100%;
    }

    li.star::before {
        content: " ";
        position: absolute;
        top: 0;
        left: 0;
        width: 24px;
        height: 29px;
        background: url(@/assets/img/star.svg) no-repeat center center/100%;
    }

    li.loading::before {
        content: " ";
        position: absolute;
        top: 2;
        left: 0;


        width: 20px;
        height: 20px;
        line-height: 30px;
        border: 2px solid pink;
        border-top-color: transparent;
        border-radius: 100%;

        animation: circle infinite 0.75s linear;
    }

    @keyframes circle {
        0% {
            transform: rotate(0);
        }

        100% {
            transform: rotate(360deg);
        }
    }

    li.active {
        color: #71ff71;
    }

    li.me:hover {
        color: #fff;
        background-color: rgb(76, 180, 108);
    }

    li.me {
        color: #febfca;
    }
}



.input-control {
    display: flex;
    flex-direction: row;
    margin-top: 1rem;

    .microphone-btn {
        background-image: url(@/assets/img/sound/play-record-50.png);
        background-size: 100%;
        width: 24px;
        height: 24px;
        margin-right: 0.5rem;
    }

    .microphone-btn.block {
        background-image: url(@/assets/img/sound/block-microphone-50.png);
        background-size: 100%;
    }

    .video-live-btn {
        width: 24px;
        height: 24px;
        margin-right: 0.5rem;

        background-size: 100% 100%;

        background-image: url(@/assets/img/sound/live-video-on.gif);
    }

    .video-live-btn.block {
        background-image: url(@/assets/img/sound/live-video-on-30.png);
    }

    .screen-share {
        background: url(@/assets/img/screen-share.svg) no-repeat center center/100%;
        width: 24px;
        height: 24px;
        margin-right: 0.5rem;
    }

    .screen-share.block {
        background: url(@/assets/img/stop-screen-share.svg) no-repeat center center/100%;
    }

    .speaker {
        background: url(@/assets/img/sound/audio-50.png) no-repeat center center/100%;
        width: 24px;
        height: 24px;
        margin-right: 0.5rem;
        margin-left: 1.5rem;
    }

    .speaker.muted {
        background: url(@/assets/img/sound/no-audio-50.png) no-repeat center center/100%;
    }



    .send-message-block {
        margin-left: auto;


        .message-send-input {
            outline: none !important;
        }

        .message-send-input:focus {
            outline: none !important;
            border: 1px solid red;
            box-shadow: 0 0 10px #719ECE;
        }

    }

    .message-send-btn {
        margin-left: .2rem;
    }

    .message-histories-btn {
        background: url(@/assets/img/time-machine-24.png);
        width: 24px;
        height: 24px;
        display: inline-block;
        vertical-align: middle;
        margin-right: 0.5rem;
    }
}
</style>