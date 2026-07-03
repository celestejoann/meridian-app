import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { COLORS, FONTS, AREA_COLORS } from '../constants/theme';

const SHAPE_LABELS = {
  get_back_to: 'Keep meaning to get back to',
  working_toward: 'Working toward, no plan',
  messy_middle: 'In the middle, messy',
  someday: 'Someday, eventually',
};

function areaDisplayName(area) {
  return (area || 'area').replace(/^\w/, (c) => c.toUpperCase());
}

export default function PursuitDetailScreen() {
  const route = useRoute();
  const pursuitId = route.params?.pursuitId;
  const [loading, setLoading] = useState(true);
  const [pursuit, setPursuit] = useState(null);

  const load = useCallback(async () => {
    if (!pursuitId) {
      setPursuit(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', pursuitId)
      .maybeSingle();

    if (error) {
      console.log('load pursuit error:', error.message);
    }
    setPursuit(data ?? null);
    setLoading(false);
  }, [pursuitId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const areaKey = (pursuit?.area || '').toLowerCase();
  const areaColor = AREA_COLORS[areaKey] || COLORS.accent;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={COLORS.accent} size={32} />
        </View>
      ) : !pursuit ? (
        <View style={styles.loaderWrap}>
          <Text style={styles.placeholderText}>Pursuit not found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {pursuit.area ? (
            <View
              style={[
                styles.areaPill,
                {
                  backgroundColor: areaColor + '22',
                  borderColor: areaColor,
                },
              ]}>
              <Text style={[styles.areaPillText, { color: areaColor }]}>
                {areaDisplayName(pursuit.area).toUpperCase()}
              </Text>
            </View>
          ) : null}

          <Text style={styles.title}>{pursuit.title}</Text>

          {pursuit.shape ? (
            <Text style={styles.shapeLabel}>{SHAPE_LABELS[pursuit.shape]}</Text>
          ) : null}

          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>Moments</Text>
            <Text style={styles.placeholderText}>
              Your moment feed will live here — a running log of what this
              pursuit means as it unfolds.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  areaPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  areaPillText: {
    fontSize: 10,
    fontFamily: FONTS.bodyMedium,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: 'PlayfairDisplay_300Light',
    fontSize: 30,
    color: COLORS.text,
    lineHeight: 38,
    marginBottom: 8,
  },
  shapeLabel: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  placeholderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeholderTitle: {
    fontSize: 10,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.mutedLight,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
