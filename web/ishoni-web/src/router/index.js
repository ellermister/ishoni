import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RoomView from '../views/RoomView.vue'
import CreateRoom from '../views/CreateRoom.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/room/:id',
      name: 'room',
      component: RoomView
    },
    {
      path: '/create-room',
      name: 'create-room',
      component: CreateRoom
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    },
    {
      name: 'setting',
      path: '/setting',
      component: () => import('@/views/SettingView.vue')
    },
    {
      name: '404',
      path: '/404',
      component: () => import('@/views/NotFound.vue')
    },
    {
      path: '/:pathMatch(.*)*', 
      redirect: '/404'
    }
  ]
})

export default router
