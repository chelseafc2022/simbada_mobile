jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/app/files',
  CachesDirectoryPath: '/app/cache',
  ExternalStorageDirectoryPath: '/sdcard',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => {}),
  writeFile: jest.fn(async () => {}),
  copyFile: jest.fn(async () => {}),
}));
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn(async () => {}) },
}));

import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import JSZip from 'jszip';
import GeoExporter from '../views/library/GeoExporter';

const tracks = [{
  id: 'track-1', label: 'Trek Uji', startTime: '2026-11-06T00:00:00Z',
  metrics: { totalDistance: 100, duration: 60 },
  waypoints: [{ lat: -4, lon: 122, ts: 1793923200000, speed: 1 }],
}];

beforeEach(() => jest.clearAllMocks());

test.each(['KMZ', 'GPX', 'CSV'])('%s exports a track to app-owned storage', async format => {
  const path = await GeoExporter[`export${format}`]([], tracks);
  expect(path).toMatch(new RegExp(`^/app/files/ekspor/simbada_.*\\.${format.toLowerCase()}$`));
  expect(RNFS.mkdir).toHaveBeenCalledWith('/app/files/ekspor');
  const [savedPath, content, encoding] = RNFS.writeFile.mock.calls[0];
  expect(savedPath).toBe(path);
  if (format === 'KMZ') {
    const zip = await JSZip.loadAsync(content, { base64: true });
    expect(await zip.file('doc.kml').async('string')).toContain('122,-4,0');
    expect(encoding).toBe('base64');
  } else {
    expect(content).toContain(format === 'GPX' ? 'lat="-4" lon="122"' : '"-4","122"');
    expect(encoding).toBe('utf8');
  }
});

test('shares a cache copy while retaining the original export', async () => {
  await GeoExporter.shareFile('/app/files/ekspor/trek.kmz', 'application/vnd.google-earth.kmz');
  expect(RNFS.copyFile).toHaveBeenCalledWith('/app/files/ekspor/trek.kmz', '/app/cache/ekspor/trek.kmz');
  expect(Share.open).toHaveBeenCalledWith(expect.objectContaining({
    url: 'file:///app/cache/ekspor/trek.kmz', type: 'application/vnd.google-earth.kmz',
  }));
});
