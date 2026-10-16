import {Capacitor} from '@capacitor/core';
export const isNative=()=>Capacitor.isNativePlatform();
export const platformName=()=>isNative()?'android':'web';
