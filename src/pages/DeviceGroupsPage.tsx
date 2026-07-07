import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { CreateDeviceGroupModal } from '../components/device-groups/CreateDeviceGroupModal';
import { DeviceGroupDetailDrawer } from '../components/device-groups/DeviceGroupDetailDrawer';
import { DeviceGroupsGrid } from '../components/device-groups/DeviceGroupsGrid';
import Header from '../components/layout/Header';
import RoleAccessNotice from '../components/ui/RoleAccessNotice';
import { useCreateDeviceGroup, useDeviceGroups } from '../hooks/useDeviceGroups';
import type { DeviceGroup } from '../lib/database.types';
import { canDeleteAdminResources, canManageDevices, getRoleLabel } from '../lib/role-access';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

export default function DeviceGroupsPage() {
  const { data: groups, isLoading } = useDeviceGroups();
  const profile = useAuthStore((s) => s.profile);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createGroup = useCreateDeviceGroup();
  const addToast = useUIStore((s) => s.addToast);
  const canManageGroups = canManageDevices(profile?.role);
  const canDeleteGroups = canDeleteAdminResources(profile?.role);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageGroups) {
      addToast('Only operators and admins can create device groups', 'error');
      return;
    }
    try {
      await createGroup.mutateAsync({ name, description });
      addToast('Group created', 'success');
      setShowCreate(false);
      setName('');
      setDescription('');
    } catch {
      addToast('Failed to create group', 'error');
    }
  };

  return (
    <>
      <Header
        title="Device Groups"
        subtitle={`${groups?.length ?? 0} groups`}
        actions={
          <button
            onClick={() => {
              if (!canManageGroups) {
                addToast('Only operators and admins can create device groups', 'error');
                return;
              }
              setShowCreate(true);
            }}
            disabled={!canManageGroups}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {!canManageGroups && (
          <div className="mb-5">
            <RoleAccessNotice
              title={`${getRoleLabel(profile?.role)} role can inspect device groups but not change them`}
              detail="You can view group structure and member devices. Only operators and admins can create groups or change device membership."
            />
          </div>
        )}
        <DeviceGroupsGrid groups={groups} isLoading={isLoading} onSelectGroup={setSelectedGroup} />
      </div>

      <CreateDeviceGroupModal
        description={description}
        isSubmitting={createGroup.isPending}
        name={name}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onDescriptionChange={setDescription}
        onNameChange={setName}
        onSubmit={handleCreate}
      />

      {selectedGroup && (
        <DeviceGroupDetailDrawer
          canDelete={canDeleteGroups}
          canManage={canManageGroups}
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </>
  );
}
