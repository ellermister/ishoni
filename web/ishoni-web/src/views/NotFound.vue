<template>
    <div class="container">
        <div class="panel">
            <p>404 Not found</p>

        </div>

    </div>
</template>
<style scoped>
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
    text-align: center;
    position: relative;
    -webkit-transition: all 0.2s ease-in-out;
    transition: all 0.2s ease-in-out;

    display: flex;
    flex-direction: row;

    height: 100%;
}

.panel p {
    font-weight: bolder;
    color: pink;
    font-size: 1.4rem;
    margin-top: 0;
}
</style>