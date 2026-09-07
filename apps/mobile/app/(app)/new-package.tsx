import { StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';

export default function NewPackageScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>📦</Text>
        <Text style={styles.title}>{t('newPackage.title')}</Text>
        <Text style={styles.subtitle}>{t('newPackage.subtitle')}</Text>
      </View>

      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonText}>{t('newPackage.comingSoon')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { alignItems: 'center', paddingVertical: 32 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  comingSoon: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  comingSoonText: { fontSize: 15, color: '#94a3b8', fontStyle: 'italic' },
});
