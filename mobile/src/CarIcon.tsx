import { StyleSheet, View } from 'react-native';

/**
 * White car glyph drawn with Views (no SVG library), in the same chunky style as the
 * map's binoculars pin: solid shapes with window and hub cut-outs in the button's color.
 * Geometry is on a 24×24 grid, matching CAR_SVG in LeafletMap.tsx.
 */
export default function CarIcon({ size = 24, color = '#fff', cut }: {
  size?: number;
  color?: string;
  /** Background color the windows, hubs and wheel gaps are "cut" in */
  cut: string;
}) {
  const k = size / 24;
  const box = (x: number, y: number, w: number, h: number) => ({
    position: 'absolute' as const, left: x * k, top: y * k, width: w * k, height: h * k,
  });
  const circle = (cx: number, cy: number, r: number, fill: string) => (
    <View style={[box(cx - r, cy - r, r * 2, r * 2), { borderRadius: r * k, backgroundColor: fill }]} />
  );
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      {/* cabin + windows */}
      <View style={[box(6, 4, 12, 8), { backgroundColor: color, borderTopLeftRadius: 3.5 * k, borderTopRightRadius: 3.5 * k }]} />
      <View style={[box(8, 6, 3.5, 4), styles.window, { backgroundColor: cut, borderTopLeftRadius: 1.5 * k }]} />
      <View style={[box(12.5, 6, 3.5, 4), styles.window, { backgroundColor: cut, borderTopRightRadius: 1.5 * k }]} />
      {/* body */}
      <View style={[box(2, 10.5, 20, 7), { backgroundColor: color, borderRadius: 2.5 * k }]} />
      {/* wheels: a cut-color ring separates each from the body, then tyre and hub */}
      {circle(7, 17.5, 3.8, cut)}
      {circle(7, 17.5, 2.9, color)}
      {circle(7, 17.5, 1.2, cut)}
      {circle(17, 17.5, 3.8, cut)}
      {circle(17, 17.5, 2.9, color)}
      {circle(17, 17.5, 1.2, cut)}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { borderRadius: 0.5 },
});
