import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';

export default function SupportScreen() {
  const openWhatsApp = () => {
    Linking.openURL('https://wa.me/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>💬</Text>
        <Text style={styles.title}>{t('support.title')}</Text>
        <Text style={styles.subtitle}>{t('support.subtitle')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📱</Text>
        <Text style={styles.cardTitle}>{t('support.whatsapp')}</Text>
        <Text style={styles.cardDesc}>{t('support.whatsappDesc')}</Text>
        <Pressable style={styles.button} onPress={openWhatsApp}>
          <Text style={styles.buttonText}>{t('support.contactNow')}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>📧</Text>
        <Text style={styles.cardTitle}>{t('support.email')}</Text>
        <Text style={styles.cardDesc}>{t('support.emailDesc')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>🕐</Text>
        <Text style={styles.cardTitle}>{t('support.hours')}</Text>
        <Text style={styles.cardDesc}>{t('support.hoursDesc')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { alignItems: 'center', paddingVertical: 24 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  button: {
    backgroundColor: '#25c866',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
