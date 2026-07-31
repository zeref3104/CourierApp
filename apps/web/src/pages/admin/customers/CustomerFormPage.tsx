import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { customerService } from '../../../services/customer.service';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({
    name: '', lastName: '', document: '', phone: '',
    email: '', address: '', notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    customerService
      .findById(id)
      .then((res) => {
        const c = res.data;
        setForm({
          name: c.name || '',
          lastName: c.lastName || '',
          document: c.document || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          notes: c.notes || '',
        });
      })
      .catch(() => alert('Error al cargar cliente'))
      .finally(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await customerService.update(id!, form);
      } else {
        const res = await customerService.create(form);
        navigate(`/customers/${res.data._id}`);
        return;
      }
      navigate(`/customers/${id}`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="text-center py-12 text-gray-500">Cargando...</div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Apellido" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Documento" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>Guardar</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/customers')}>Cancelar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
