import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import UploadView from '../views/UploadView.vue';
import LogbookView from '../views/LogbookView.vue';
import SettingsView from '../views/SettingsView.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/upload',
    name: 'Upload',
    component: UploadView,
  },
  {
    path: '/logbook',
    name: 'Logbook',
    component: LogbookView,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;