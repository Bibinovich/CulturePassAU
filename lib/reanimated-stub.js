/**
 * Safe no-op stub for react-native-reanimated on web.
 *
 * Metro resolves this file instead of the real Reanimated package on the web
 * platform (see metro.config.js). This prevents the "Cannot convert undefined
 * or null to object" crash that Reanimated's native initializer throws in a
 * browser environment.
 *
 * react-native-gesture-handler checks `Reanimated?.useSharedValue`; when that
 * is absent it falls back to its own non-Reanimated implementation, so
 * GestureHandlerRootView continues to work normally.
 */

// Deliberately does NOT export `useSharedValue` so gesture-handler falls back.
const noop = () => {};
const identity = (x) => x;

export default { createAnimatedComponent: identity };

export const createAnimatedComponent = identity;
export const useAnimatedStyle = () => ({});
export const useAnimatedProps = () => ({});
export const withSpring = identity;
export const withTiming = identity;
export const withRepeat = identity;
export const withSequence = (...args) => args[0];
export const withDelay = (_, val) => val;
export const withDecay = identity;
export const withClamp = identity;
export const runOnJS = (fn) => fn;
export const runOnUI = (fn) => fn;
export const makeMutable = (val) => ({ value: val });
export const useAnimatedReaction = noop;
export const useDerivedValue = (fn) => ({ value: fn() });
export const useAnimatedRef = () => ({ current: null });
export const useFrameCallback = noop;
export const useScrollOffset = () => ({ value: 0 });
export const useAnimatedScrollHandler = () => ({});
export const useAnimatedKeyboard = () => ({ height: { value: 0 }, state: { value: 0 } });
export const useAnimatedSensor = () => ({ sensor: { value: {} }, unregister: noop });
export const useReducedMotion = () => false;
export const interpolate = (val, _input, output) => output[0] ?? val;
export const interpolateColor = (val, _input, output) => output[0] ?? '#000';
export const Easing = {
  linear: identity,
  ease: identity,
  quad: identity,
  cubic: identity,
  sin: identity,
  circle: identity,
  exp: identity,
  elastic: () => identity,
  back: () => identity,
  bounce: identity,
  bezier: () => identity,
  in: identity,
  out: identity,
  inOut: identity,
};
export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' };
export const cancelAnimation = noop;
export const measure = () => null;
export const scrollTo = noop;
export const dispatchCommand = noop;
export const setNativeProps = noop;
export const enableLayoutAnimations = noop;
export const configureReanimatedLogger = noop;
export const isReanimated3 = () => false;
export const isConfigured = () => false;

// Layout animation builders — return null on web (no-op)
const noopBuilder = {
  duration: () => noopBuilder,
  delay: () => noopBuilder,
  easing: () => noopBuilder,
  springify: () => noopBuilder,
  damping: () => noopBuilder,
  stiffness: () => noopBuilder,
  build: () => null,
};
export const FadeIn = noopBuilder;
export const FadeOut = noopBuilder;
export const FadeInDown = noopBuilder;
export const FadeInUp = noopBuilder;
export const FadeInLeft = noopBuilder;
export const FadeInRight = noopBuilder;
export const FadeOutDown = noopBuilder;
export const FadeOutUp = noopBuilder;
export const SlideInDown = noopBuilder;
export const SlideInUp = noopBuilder;
export const SlideOutDown = noopBuilder;
export const SlideOutUp = noopBuilder;
export const ZoomIn = noopBuilder;
export const ZoomOut = noopBuilder;
export const ZoomInDown = noopBuilder;
export const ZoomInUp = noopBuilder;
export const BounceIn = noopBuilder;
export const BounceOut = noopBuilder;
export const Layout = noopBuilder;
export const LinearTransition = noopBuilder;
