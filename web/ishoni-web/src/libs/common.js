import EventEmitter from 'events';
const eventer = new EventEmitter()
let clicked = false

document.addEventListener('click',()=> {
    clicked = true
    eventer.emit('page.click')
})

export const waitClicked = ()=>{
    return new Promise((resolve)=>{
        if(clicked){
            resolve()
        }else{
            eventer.once('page.click', resolve)
        }
    })
}