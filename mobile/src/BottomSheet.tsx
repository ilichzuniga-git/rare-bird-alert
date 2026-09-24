import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { colors, radius } from './theme';

export interface BottomSheetHandle {
  snapTo(index: number): void;
  getIndex(): number;
}

interface Props {
  /** Visible heights in px, ascending (e.g. peek, half, full). */
  snapPoints: number[];
  initialIndex: number;
  onIndexChange?: (index: number) => void;
  /** Rendered above the content; dragging it moves the sheet. Taps still reach its buttons. */
  header: ReactNode;
  /** Scrollable content. Receives the height hidden below the screen so it can pad its end. */
  children: (hiddenHeight: number) => ReactNode;
}

/**
 * Draggable bottom sheet with snap points, built on Animated + PanResponder so it
 * needs no gesture/animation libraries. Only the header drags, which keeps the
 * content's own vertical scrolling conflict-free.
 */
const BottomSheet = forwardRef<BottomSheetHandle, Props>(function BottomSheet(
  { snapPoints, initialIndex, onIndexChange, header, children },
  ref,
) {
  const maxH = snapPoints[snapPoints.length - 1];
  const offsetFor = (i: number) => maxH - snapPoints[i];

  const [index, setIndex] = useState(initialIndex);
  const indexRef = useRef(initialIndex);
  const translateY = useRef(new Animated.Value(offsetFor(initialIndex))).current;
  const currentOffset = useRef(offsetFor(initialIndex));
  const dragStart = useRef(0);

  const snapTo = (i: number, velocity = 0) => {
    const target = Math.max(0, Math.min(snapPoints.length - 1, i));
    currentOffset.current = offsetFor(target);
    Animated.spring(translateY, {
      toValue: offsetFor(target),
      velocity,
      damping: 26,
      stiffness: 260,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
    if (target !== indexRef.current) {
      indexRef.current = target;
      setIndex(target);
      onIndexChange?.(target);
    }
  };

  useImperativeHandle(ref, () => ({ snapTo: i => snapTo(i), getIndex: () => indexRef.current }));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation(v => {
            currentOffset.current = v;
          });
          dragStart.current = currentOffset.current;
        },
        onPanResponderMove: (_, g) => {
          const next = Math.max(0, Math.min(offsetFor(0), dragStart.current + g.dy));
          currentOffset.current = next;
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          // Project where a flick would carry the sheet, then pick the nearest snap
          const projectedVisible = maxH - (currentOffset.current + g.vy * 180);
          let best = 0;
          snapPoints.forEach((h, i) => {
            if (Math.abs(h - projectedVisible) < Math.abs(snapPoints[best] - projectedVisible)) best = i;
          });
          snapTo(best, -g.vy);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    // snapPoints are fixed for the sheet's lifetime (derived from the window size)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxH],
  );

  return (
    <Animated.View style={[styles.sheet, { height: maxH, transform: [{ translateY }] }]}>
      <View {...pan.panHandlers}>
        <View style={styles.grabZone}>
          <View style={styles.grab} />
        </View>
        {header}
      </View>
      <View style={styles.content}>{children(offsetFor(index))}</View>
    </Animated.View>
  );
});

export default BottomSheet;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
  },
  grabZone: { paddingTop: 8, paddingBottom: 4, alignItems: 'center' },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.grab },
  content: { flex: 1 },
});
