import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS } from '../../constants/theme';
import { ProgressDots } from './shared';

const AREA_PLACEHOLDERS = {
  health: 'takes care of their body',
  finance: 'stewards their finances well',
  career: 'does meaningful work',
  relationships: 'shows up for the people I love',
  growth: 'keeps learning and growing',
  recreation: 'makes time for joy',
  spirituality: 'trusts in something greater',
};

const CUSTOM_AREA_PLACEHOLDER = 'lives this value intentionally';

function getAreaPlaceholder(area) {
  if (area.isCustom) return CUSTOM_AREA_PLACEHOLDER;
  return AREA_PLACEHOLDERS[area.slug] ?? CUSTOM_AREA_PLACEHOLDER;
}

export default function IdentityScreen({ route, navigation }) {
  const { selectedAreas = [], userName = '' } = route.params || {};
  const [statements, setStatements] = useState({});

  const handleContinue = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const toInsert = selectedAreas
        .filter((a) => statements[a.slug]?.trim())
        .map((a) => ({
          user_id: user.id,
          area_slug: a.slug,
          statement: statements[a.slug].trim(),
        }));

      if (toInsert.length > 0) {
        await supabase.from('user_identities').insert(toInsert);
      }

      navigation.navigate('Commitment', {
        selectedAreas,
        userName,
      });
    } catch (e) {
      console.log('Error:', e.message);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: COLORS.bg,
      }}>
      <ProgressDots step={4} total={6} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 32,
            paddingBottom: 200,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text
            style={{
              fontSize: 32,
              fontFamily: FONTS.headingBold,
              color: COLORS.text,
              marginBottom: 8,
              marginTop: 24,
            }}>
            Now — who are you?
          </Text>

          <Text
            style={{
              fontSize: 15,
              fontFamily: FONTS.body,
              color: COLORS.muted,
              marginBottom: 32,
              lineHeight: 24,
            }}>
            Not who you're trying to become.{'\n'}
            Who you already are.
          </Text>

          {selectedAreas.map((area) => (
            <View key={area.slug} style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: FONTS.bodyMedium,
                  color: area.color,
                  letterSpacing: 1,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}>
                {area.icon} {area.name}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: FONTS.body,
                  color: COLORS.muted,
                  marginBottom: 4,
                }}>
                I am someone who...
              </Text>
              <TextInput
                style={{
                  fontSize: 16,
                  fontFamily: FONTS.body,
                  color: COLORS.text,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                  paddingVertical: 8,
                  fontStyle: 'italic',
                }}
                placeholder={getAreaPlaceholder(area)}
                placeholderTextColor={COLORS.border}
                value={statements[area.slug] || ''}
                onChangeText={(val) =>
                  setStatements((prev) => ({ ...prev, [area.slug]: val }))
                }
              />
            </View>
          ))}

          <Text
            style={{
              fontSize: 11,
              color: COLORS.muted,
              fontStyle: 'italic',
              textAlign: 'center',
              marginTop: 16,
              paddingHorizontal: 32,
            }}>
            These are just examples —{'\n'}
            write what feels true for you.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.accent,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginTop: 32,
            }}
            onPress={handleContinue}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: 16,
                fontFamily: FONTS.bodyMedium,
              }}>
              This is me →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
