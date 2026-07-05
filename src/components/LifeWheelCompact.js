import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, {
  Circle,
  Defs,
  Line,
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS, FONTS } from '../constants/theme';

const HINT_STORAGE_KEY = 'life_wheel_tap_hint_seen';
const MAX_RADIUS_RATIO = 0.24;
const LABEL_FONT_SIZE = 11;
const LABEL_LINE_HEIGHT = 14;
const LABEL_RADIUS_OFFSET = 50;
const LABEL_EDGE_BUFFER = 8;
const TOOLTIP_WIDTH = 224;
const HIT_SIZE = 44;

function getWheelLabel(area) {
  return (area.name || area.slug || area.area || 'general').toUpperCase();
}

function estimateLabelHalfWidth(label) {
  return (label.length * LABEL_FONT_SIZE * 0.58) / 2;
}

function getLabelLines(label) {
  return [label];
}

function getLabelFillOpacity(vibrancy, selected) {
  const base = Math.max(vibrancy ?? 0.35, 0.55);
  return selected ? Math.min(base + 0.2, 1) : base;
}

export default function LifeWheelCompact({
  areas,
  chartWidth: chartWidthProp,
  enableHint = true,
  interactive = true,
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const hintOpacity = useState(() => new Animated.Value(0))[0];
  const chartWidth = chartWidthProp ?? Dimensions.get('window').width - 48;
  const maxRadius = chartWidth * MAX_RADIUS_RATIO;
  const totalAreas = areas.length;

  const dismissHint = useCallback(async () => {
    if (!showHint) {
      await AsyncStorage.setItem(HINT_STORAGE_KEY, '1');
      return;
    }
    Animated.timing(hintOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => setShowHint(false));
    await AsyncStorage.setItem(HINT_STORAGE_KEY, '1');
  }, [showHint, hintOpacity]);

  useEffect(() => {
    if (!enableHint) return undefined;
    let mounted = true;
    AsyncStorage.getItem(HINT_STORAGE_KEY).then((value) => {
      if (mounted && !value) {
        setShowHint(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [enableHint]);

  useEffect(() => {
    if (!showHint) return undefined;
    Animated.timing(hintOpacity, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      dismissHint();
    }, 4500);
    return () => clearTimeout(timer);
  }, [showHint, hintOpacity, dismissHint]);

  const dismissTooltip = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const toggleArea = useCallback(
    (index) => {
      dismissHint();
      setSelectedIndex((current) => (current === index ? null : index));
    },
    [dismissHint]
  );

  const activeArea = useMemo(() => {
    if (selectedIndex == null || selectedIndex < 0 || selectedIndex >= areas.length) {
      return null;
    }
    return areas[selectedIndex];
  }, [areas, selectedIndex]);

  if (totalAreas === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>Your life wheel fills in as you add areas</Text>
      </View>
    );
  }

  const labelRadius = maxRadius + LABEL_RADIUS_OFFSET;
  const labelClearance = LABEL_LINE_HEIGHT / 2 + LABEL_EDGE_BUFFER;

  const maxLabelHalfWidth = areas.reduce((max, area) => {
    const label = getWheelLabel(area);
    return Math.max(max, estimateLabelHalfWidth(label));
  }, 0);

  const horizontalExtent = labelRadius + maxLabelHalfWidth + LABEL_EDGE_BUFFER;
  const verticalExtent = labelRadius + labelClearance;
  const svgWidth = Math.max(chartWidth, horizontalExtent * 2);
  const svgHeight = verticalExtent * 2;
  const cx = svgWidth / 2;
  const cy = svgHeight / 2;
  const marginLeft = -(svgWidth - chartWidth) / 2;

  const getPoint = (index, radius) => {
    const angle = (index / totalAreas) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  const gridRings = [0.25, 0.5, 0.75, 1.0].map((ratio) => {
    const points = Array.from({ length: totalAreas }, (_, i) => {
      const p = getPoint(i, maxRadius * ratio);
      return `${p.x},${p.y}`;
    }).join(' ');
    return { points, ratio };
  });

  const dataPoints = areas.map((area, i) => {
    const r = area.spokeLengthRatio * maxRadius;
    return getPoint(i, r);
  });
  const dataPolygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const spokeLines = Array.from({ length: totalAreas }, (_, i) => {
    const outer = getPoint(i, maxRadius);
    return { x2: outer.x, y2: outer.y };
  });

  const tooltipAnchor =
    selectedIndex != null ? getPoint(selectedIndex, labelRadius * 0.72) : null;
  const tooltipLeft = tooltipAnchor
    ? Math.max(
        8,
        Math.min(
          marginLeft + tooltipAnchor.x - TOOLTIP_WIDTH / 2,
          chartWidth - TOOLTIP_WIDTH - 8
        )
      )
    : 0;
  const tooltipBelow = tooltipAnchor ? tooltipAnchor.y < cy : true;

  return (
    <View style={styles.container}>
      <View style={[styles.wrap, { width: chartWidth, height: svgHeight }]}>
        <Pressable style={styles.dismissLayer} onPress={dismissTooltip} />

        <Svg
          width={svgWidth}
          height={svgHeight}
          pointerEvents="none"
          style={{ marginLeft }}>
          <Defs>
            <RadialGradient id="wheelFillCompact" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#a78bfa" stopOpacity="0.04" />
              <Stop offset="100%" stopColor="#a78bfa" stopOpacity="0.14" />
            </RadialGradient>
          </Defs>

          {gridRings.map(({ points, ratio }) => (
            <Polygon
              key={ratio}
              points={points}
              fill="none"
              stroke="#2a2040"
              strokeWidth={ratio === 1.0 ? 1.2 : 0.8}
            />
          ))}

          {spokeLines.map((s, i) => (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={s.x2}
              y2={s.y2}
              stroke="#2a2040"
              strokeWidth={0.8}
            />
          ))}

          {dataPoints.some((p) => p.x !== cx || p.y !== cy) ? (
            <Polygon
              points={dataPolygonPoints}
              fill="url(#wheelFillCompact)"
              stroke="#a78bfa"
              strokeWidth={1.2}
              strokeOpacity={0.45}
            />
          ) : null}

          {areas.map((area, i) => {
            const r = area.spokeLengthRatio * maxRadius;
            if (r === 0) return null;
            const p = getPoint(i, r);
            return (
              <Circle
                key={`dot-${i}`}
                cx={p.x}
                cy={p.y}
                r={4}
                fill={area.color || COLORS.accent}
                fillOpacity={area.vibrancy}
              />
            );
          })}

          {areas.map((area, i) => {
            const p = getPoint(i, labelRadius);
            const label = getWheelLabel(area);
            const lines = getLabelLines(label);
            const lineOffset = ((lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
            const selected = selectedIndex === i;
            const labelColor = area.color || COLORS.accent;
            const labelOpacity = getLabelFillOpacity(area.vibrancy, selected);
            const underlineHalfWidth = estimateLabelHalfWidth(label);

            return (
              <React.Fragment key={`label-group-${area.slug || i}`}>
                {lines.map((line, lineIndex) => (
                  <SvgText
                    key={`label-${i}-${lineIndex}`}
                    x={p.x}
                    y={p.y - lineOffset + lineIndex * LABEL_LINE_HEIGHT}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontSize={LABEL_FONT_SIZE}
                    fill={labelColor}
                    fillOpacity={labelOpacity}
                    fontFamily="DMSans_700Bold">
                    {line}
                  </SvgText>
                ))}
                <Line
                  x1={p.x - underlineHalfWidth}
                  x2={p.x + underlineHalfWidth}
                  y1={p.y + LABEL_FONT_SIZE / 2 + 2}
                  y2={p.y + LABEL_FONT_SIZE / 2 + 2}
                  stroke={labelColor}
                  strokeOpacity={selected ? 0.85 : 0.45}
                  strokeWidth={0.75}
                />
              </React.Fragment>
            );
          })}

          <Circle cx={cx} cy={cy} r={2.5} fill="#a78bfa" fillOpacity={0.35} />
        </Svg>

        {interactive
          ? areas.map((area, i) => {
          const labelPoint = getPoint(i, labelRadius);
          const hitCenterX = marginLeft + labelPoint.x;
          const hitCenterY = labelPoint.y;

          return (
            <Pressable
              key={`hit-${area.slug || i}`}
              style={[
                styles.hitTarget,
                {
                  left: hitCenterX - HIT_SIZE / 2,
                  top: hitCenterY - HIT_SIZE / 2,
                },
              ]}
              onPress={() => toggleArea(i)}
              accessibilityRole="button"
              accessibilityLabel={`${getWheelLabel(area)} life area`}
              accessibilityHint="Shows identity statement"
            />
          );
        })
          : null}

        {interactive && activeArea && tooltipAnchor ? (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              {
                left: tooltipLeft,
                width: TOOLTIP_WIDTH,
                borderLeftColor: activeArea.color || COLORS.accent,
                ...(tooltipBelow
                  ? { top: tooltipAnchor.y + 12 }
                  : { bottom: svgHeight - tooltipAnchor.y + 12 }),
              },
            ]}>
            <Text style={styles.tooltipText}>
              {activeArea.identityStatement ||
                'No identity statement for this area yet.'}
            </Text>
          </View>
        ) : null}
      </View>

      {enableHint && showHint ? (
        <Animated.Text style={[styles.hintText, { opacity: hintOpacity }]}>
          Tap a label to see who you are
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  wrap: {
    alignItems: 'center',
    alignSelf: 'center',
    opacity: 0.88,
    overflow: 'visible',
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  hitTarget: {
    position: 'absolute',
    width: HIT_SIZE,
    height: HIT_SIZE,
    zIndex: 2,
  },
  tooltip: {
    position: 'absolute',
    zIndex: 3,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
  },
  tooltipText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  hintText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.mutedLight,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  emptyWrap: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
