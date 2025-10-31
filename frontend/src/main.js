// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router'; // <-- 1. Importa el router
//import './assets/main.css';   // <-- 2. Importa el CSS global
import './assets/styles/design-tokens.css';  // ← Nueva línea 1
import './style.css';                         // ← Nueva línea 2

const app = createApp(App);

app.use(router); // <-- 3. Le dice a Vue que use el router

app.mount('#app');