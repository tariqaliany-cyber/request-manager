// Which administrative region each branch area (the "area" column of
// location.xlsx / branchData.js) belongs to, plus the area's approximate
// city-centre coordinates [lon, lat]. The branch list has no per-branch
// coordinates (its map links are short goo.gl URLs), so branch points on the
// region map are drawn at their city, fanned out slightly when a city has
// several branches. A new area missing here shows under «غير محدد».
import { getBranchInfo } from './branchData';

export const AREA_REGION = {
  'Riyadh City':    ['riyadh', 46.72, 24.71],
  'Al-Kharj':       ['riyadh', 47.33, 24.15],
  'Shaqra':         ['riyadh', 45.25, 25.25],
  'Majmaa':         ['riyadh', 45.34, 25.90],
  'Zulfi':          ['riyadh', 44.81, 26.30],
  'Al-Ghatt':       ['riyadh', 44.96, 26.03],
  'Hautat Sudair':  ['riyadh', 45.62, 25.59],
  'Al Humiyat':     ['riyadh', 45.30, 25.75],
  'Rumah':          ['riyadh', 47.16, 25.57],
  'Dawadmi':        ['riyadh', 44.39, 24.51],
  'Rafayah':        ['riyadh', 44.60, 24.30],
  'Qawiaiyah':      ['riyadh', 45.07, 24.06],
  'Afif':           ['riyadh', 42.92, 23.91],
  'Al Dilam':       ['riyadh', 47.16, 23.99],
  'Hotta':          ['riyadh', 47.00, 23.50],
  'Al Aflaj':       ['riyadh', 46.73, 22.29],
  'Al Dawasir':     ['riyadh', 45.00, 20.46],

  'Dammam':         ['eastern', 50.10, 26.43],
  'Al Khobar':      ['eastern', 50.21, 26.28],
  'Qateef':         ['eastern', 50.00, 26.56],
  'Qatif':          ['eastern', 50.00, 26.56],
  'Rastanurah':     ['eastern', 50.06, 26.71],
  'Jubail':         ['eastern', 49.66, 27.01],
  'Al Ahsa':        ['eastern', 49.59, 25.38],
  'Hafer Baten':    ['eastern', 45.96, 28.43],
  'Al Khafji':      ['eastern', 48.49, 28.44],

  'Buraidah':       ['qassim', 43.97, 26.33],
  'Unaizah':        ['qassim', 43.99, 26.08],
  'Al-Raas':        ['qassim', 43.50, 25.87],
  'Bukariah':       ['qassim', 43.66, 26.14],
  'Badiaa':         ['qassim', 43.73, 26.00],
  'Khabra':         ['qassim', 43.54, 26.05],
  'Muzneb':         ['qassim', 44.22, 25.86],

  'Jeddah':         ['makkah', 39.17, 21.54],
  'Makkah':         ['makkah', 39.83, 21.42],
  'Taif':           ['makkah', 40.42, 21.27],

  'Madinah':        ['madinah', 39.61, 24.47],
  'Yanbu':          ['madinah', 38.06, 24.09],

  'Abha':           ['asir', 42.50, 18.22],
  'Khamis':         ['asir', 42.73, 18.30],
  'Al Namas':       ['asir', 42.12, 19.12],
  'Al Bisha':       ['asir', 42.60, 20.00],
  'Sarat Abidah':   ['asir', 43.11, 18.17],
  'Al Wadeen':      ['asir', 42.90, 18.05],

  'Jizan':          ['jazan', 42.55, 16.89],
  'Abu Areesh':     ['jazan', 42.83, 16.97],
  'Sabya':          ['jazan', 42.63, 17.15],
  'Ad Darb':        ['jazan', 42.25, 17.72],

  'Najran':         ['najran', 44.13, 17.49],
  'Al Baha':        ['baha', 41.47, 20.01],
  'Hail':           ['hail', 41.69, 27.52],

  'Tabouk':         ['tabuk', 36.57, 28.38],
  'Umluj':          ['tabuk', 37.27, 25.02],

  'Sakaka':         ['jawf', 40.21, 29.97],
  'Domat Al Jamal': ['jawf', 39.87, 29.81],
  'Qurrayat':       ['jawf', 37.34, 31.33],
  'Tabarjal':       ['jawf', 38.22, 30.50],

  'Ar-Ar':          ['northern', 41.04, 30.98],
  'Rafhaa':         ['northern', 43.49, 29.63],
  'Turaif':         ['northern', 38.66, 31.67],
};

// { region, lon, lat, area } for a branch number, or null when unknown.
export function branchRegion(branchNumber) {
  const info = getBranchInfo(branchNumber);
  const hit = info && AREA_REGION[info.area];
  if (!hit) return null;
  return { region: hit[0], lon: hit[1], lat: hit[2], area: info.area };
}
