import { PomodoroTimer } from './Timer';
import Chrome from '../Chrome';
import { createPomodoroMenu } from './Menu';
import { History } from './History';
import StorageManager from './StorageManager';
import { SettingsSchema, PersistentSettings } from './Settings';
import { HistoryService, SoundsService, SettingsService, PomodoroService, OptionsService } from './Services';
import { BadgeObserver, TimerSoundObserver, ExpirationSoundObserver, NotificationObserver, HistoryObserver, CountdownObserver, MenuObserver } from './Observers';
import { ServiceBroker } from '../Service';
import * as Alarms from './Alarms';
import firebase from 'firebase/app';

async function run() {
  chrome.runtime.onUpdateAvailable.addListener(() => {
    // We must listen to (but do nothing with) the onUpdateAvailable event in order to
    // defer updating the extension until the next time Chrome is restarted. We do not want
    // the extension to automatically reload on update since a Pomodoro might be running.
    // See https://developer.chrome.com/apps/runtime#event-onUpdateAvailable.
  });

  firebase.initializeApp({
    apiKey: "AIzaSyACuCp3OtnKvo1Pb0LVHF-OJrpw_EKOXOo", // fake api key
    authDomain: "marinara-da936.firebaseapp.com",
    databaseURL: "https://marinara-da936.firebaseio.com",
    projectId: "marinara-da936",
    storageBucket: "marinara-da936.appspot.com",
    messagingSenderId: "1045080728495",
    appId: "1:1045080728495:web:877f08b8f4d78a8907055a"
  });

  let settingsManager = new StorageManager(new SettingsSchema(), Chrome.storage.local);
  let settings = await PersistentSettings.create(settingsManager);
  let timer = new PomodoroTimer(settings);
  let history = new History();

  let menu = createPomodoroMenu(timer);
  timer.observe(new HistoryObserver(history));
  timer.observe(new BadgeObserver());
  timer.observe(new NotificationObserver(timer, settings, history));
  timer.observe(new ExpirationSoundObserver(settings));
  timer.observe(new TimerSoundObserver(settings));
  timer.observe(new CountdownObserver(settings));
  timer.observe(new MenuObserver(menu));

  menu.apply();
  settingsManager.on('change', () => menu.apply());

  Alarms.install(timer, settingsManager);
  chrome.browserAction.onClicked.addListener(() => {
    if (timer.isRunning) {
      timer.pause();
    } else if (timer.isPaused) {
      timer.resume();
    } else {
      timer.start();
    }
  });

  ServiceBroker.register(new HistoryService(history));
  ServiceBroker.register(new SoundsService());
  ServiceBroker.register(new SettingsService(settingsManager));
  ServiceBroker.register(new PomodoroService(timer));
  ServiceBroker.register(new OptionsService());
}

run();