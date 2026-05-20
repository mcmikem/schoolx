// File: src/components/CoCurricularEditor.tsx
// File: src/components/CoCurricularEditor.tsx
import { useState, useCallback } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';

export type CoCurricular = {
  id: string;
  name: string;
  description?: string;
};

interface Props {
  activity?: CoCurricular;
  onSave: (data: CoCurricular) => void;
  onCancel: () => void;
}

export const CoCurricularEditor = ({ activity, onSave, onCancel }: Props) => {
  const [name, setName] = useState(activity?.name ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');

  const handleSave = useCallback(() => {
    const payload: CoCurricular = {
      id: activity?.id ?? crypto.randomUUID(),
      name,
      description: description || undefined,
    };
    onSave(payload);
  }, [name, description, activity, onSave]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={activity ? 'Edit Co‑Curricular Activity' : 'Add Co‑Curricular Activity'}
    >
      <div className="space-y-4">
        <Input label="Name" value={name} onChange={handleNameChange} required className="w-full" />
        <div className="w-full">
          <label className="block text-sm font-medium text-[var(--on-surface)]">Description</label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            rows={3}
            className="mt-1 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors p-2"
          />
        </div>
      </div>
      <ModalFooter className="flex justify-end space-x-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>Save</Button>
      </ModalFooter>
    </Modal>
  );
};
