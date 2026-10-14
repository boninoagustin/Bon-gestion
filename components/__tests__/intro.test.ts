import { expect, it } from 'vitest';
import { browserCheck, browserPrelude } from './browserHarness';

it('keeps stalled final seconds visible until playback actually ends', async () => {
  expect(await browserCheck(browserPrelude + `
import { IntroAnimation } from './components/IntroAnimation';
HTMLMediaElement.prototype.play = () => Promise.resolve();
(async () => { try {
  sessionStorage.clear(); render(<IntroAnimation />);
  const video = document.querySelector('video');
  Object.defineProperty(video, 'duration', { value: 8 });
  video.currentTime = 6.6;
  flushSync(() => video.dispatchEvent(new Event('timeupdate')));
  await wait(1800);
  assert(video.isConnected, 'stalled video was removed before ended');
  assert(Number(getComputedStyle(video.parentElement).opacity) > 0, 'stalled video became invisible');
  flushSync(() => video.dispatchEvent(new Event('ended')));
  await wait(1600);
  assert(!video.isConnected, 'ended video did not finish');
  finish('PASS');
} catch (e) { finish(e.message); } })();
`)).toBe('PASS');
}, 40000);
