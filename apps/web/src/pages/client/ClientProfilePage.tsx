import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function ClientProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const load = useCallback(async () => {
    try {
      const api = (await import('../../config/axios')).default;
      const res = await api.get('/client/profile');
      const p = res.data.data;
      setProfile(p);
      setEmail(p.email ?? '');
      setPhone(p.phone ?? '');
      setAddress(p.address ?? '');
    } catch {
      setError(t('profile.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const api = (await import('../../config/axios')).default;
      const res = await api.patch('/client/profile', {
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      const p = res.data.data;
      setProfile(p);
      setEmail(p.email ?? '');
      setPhone(p.phone ?? '');
      setAddress(p.address ?? '');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <h1 className="text-2xl font-bold">{t('profile.title')}</h1>

      {profile && (
        <Card>
          <p className="text-lg font-semibold">{`${profile.name} ${profile.lastName}`.trim()}</p>
          <p className="text-sm text-gray-500 mt-1">{t('profile.code')}: {profile.code}</p>
          {profile.branchId && <p className="text-sm text-gray-400 mt-1">{profile.branchId.name}</p>}
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold mb-4">{t('profile.contactInfo')}</h2>
        <div className="space-y-3">
          <Input label={t('profile.email')} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          <Input label={t('profile.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t('profile.address')} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {saved && <p className="text-sm text-green-600 mt-3">✓ {t('profile.saveSuccess')}</p>}
        <div className="mt-4">
          <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
        </div>
      </Card>
    </div>
  );
}
