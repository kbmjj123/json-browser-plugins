import { createApp } from 'vue'
import App from './App.vue'
import i18n from '../../i18n'
import '../../assets/tailwind.css'
import './style.css'

// No editor stylesheet import here: the popup hosts no JSON editor. The viewer
// lives in the content script and inlines its CSS into a shadow root.
createApp(App).use(i18n).mount('#app')
