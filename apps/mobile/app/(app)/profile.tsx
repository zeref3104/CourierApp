import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchProfile, updateProfile, ClientProfileDetail } from '@/api/clientPanel';
import { t } from '@/i18n';

/**
 * Profile screen (client-panel-specs delta, task 5.8): GET /client/profile to
 * read, PATCH /client/profile to update email/phone/address. The PATCH response
 * is the updated profile, which replaces the local state (AC: "PATCH returns
 * updated profile"). Code/name/branch are read-only.
 */
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<ClientProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const p = await fetchProfile();
      setProfile(p);
      setEmail(p.email ?? '');
      setPhone(p.phone ?? '');
      setAddress(p.address ?? '');
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setSaveError(t('profile.emailInvalid'));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      setProfile(updated);
      setEmail(updated.email ?? '');
      setPhone(updated.phone ?? '');
      setAddress(updated.address ?? '');
      setSaveSuccess(true);
    } catch {
      setSaveError(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('profile.loadError')}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.name}>{`${profile.name} ${profile.lastName}`.trim()}</Text>
        <Text style={styles.code}>{t('profile.code')}: {profile.code}</Text>
        {profile.branchId ? <Text style={styles.branch}>{profile.branchId.name}</Text> : null}

        <Text style={styles.sectionTitle}>{t('profile.contactInfo')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('profile.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          testID="profile-email"
        />
        <TextInput
          style={styles.input}
          placeholder={t('profile.phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          testID="profile-phone"
        />
        <TextInput
          style={styles.input}
          placeholder={t('profile.address')}
          value={address}
          onChangeText={setAddress}
          testID="profile-address"
        />

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
        {saveSuccess ? <Text style={styles.successText}>{t('profile.saveSuccess')}</Text> : null}

        <Pressable
          style={[styles.save, saving && styles.saveDisabled]}
          disabled={saving}
          onPress={onSave}
          testID="profile-save"
        >
          <Text style={styles.saveText}>{t('common.save')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#dc2626', marginBottom: 12 },
  successText: { color: '#16a34a', marginBottom: 12 },
  retry: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  name: { fontSize: 24, fontWeight: '700' },
  code: { fontSize: 14, color: '#475569', marginTop: 4 },
  branch: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  save: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center' },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
