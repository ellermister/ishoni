<script>
export default {
  data() {
    return {
      lang: {
        zh: {
          'Fast connection through P2P connection': '通过 P2P 连接实现快速连接',
          'Multi-person voice and video calls can be made': '可以进行多人语音视频通话',
          'Can share screen, text chat': '可以进行分享屏幕、文字聊天',
          'Can transfer files directly': '可以进行直接传输文件',
          'Once depends on your network quality': '一切取决于你的网络质量',
        },
        ja: {
          'Fast connection through P2P connection': 'P2P 接続による高速接続',
          'Multi-person voice and video calls can be made': '複数人での音声通話やビデオ通話が可能',
          'Can share screen, text chat': '画面共有、テキストチャットが可能',
          'Can transfer files directly': 'ファイルを直接転送できます',
          'Once depends on your network quality': '一度はネットワークの品質に依存します',
        }
      }
    }
  },
  methods: {
    __(text) {
      let useLang = ''
      if (/^zh/.test(navigator.language)) {
        useLang = 'zh'
      }
      if (/^ja/.test(navigator.language)) {
        useLang = 'ja'
      }
      return (this.lang[useLang] && this.lang[useLang][text]) ? this.lang[useLang][text] : text
    }
  }
}

</script>

<template>
  <div class="container">
    <div class="panel">
      <h1>P2P (Peer to Peer) Demo</h1>
      <br>
      <p>1. {{ __('Fast connection through P2P connection') }}</p>
      <p>2. {{ __('Multi-person voice and video calls can be made') }} </p>
      <p>3. {{ __('Can share screen, text chat') }} </p>
      <p>4. {{ __('Can transfer files directly') }} </p>
      <p>5. {{ __('Once depends on your network quality') }} </p>
      <br>
      <button class="btn" @click="$router.push({ name: 'create-room' })">GO</button>
    </div>
  </div>

</template>

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
  text-align: left;
  position: relative;
  -webkit-transition: all 0.2s ease-in-out;
  transition: all 0.2s ease-in-out;

  display: flex;
  flex-direction: column;

  height: 100%;

  h1 {
    color: pink;
  }

  p {
    font-weight: bolder;
    color: pink;
    font-size: 1.4rem;
    margin-top: 0;
  }



}
</style>
