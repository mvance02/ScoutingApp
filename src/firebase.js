import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyC56xjXQ6slEDmciav8SiLOF9b9gELH2RA',
  authDomain: 'recruiting-490120.firebaseapp.com',
  projectId: 'recruiting-490120',
  storageBucket: 'recruiting-490120.firebasestorage.app',
  messagingSenderId: '234760157344',
  appId: '1:234760157344:web:744cfd4f60c7194c9031c5',
  measurementId: 'G-LCMQGBKG1C',
}

export const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)

