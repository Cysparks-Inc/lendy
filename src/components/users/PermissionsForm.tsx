import React from 'react';
import { PERMISSIONS, Permission, PERMISSION_GROUPS } from '@/config/permissions';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PermissionsFormProps {
  selectedPermissions: Permission[];
  onChange: (permission: Permission, checked: boolean) => void;
  disabled?: boolean;
}

export const PermissionsForm: React.FC<PermissionsFormProps> = ({ 
  selectedPermissions, 
  onChange, 
  disabled = false 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
        <Card key={groupKey} className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.permissions.map((permission) => (
              <div key={permission} className="flex items-center space-x-2">
                <Checkbox
                  id={permission}
                  checked={selectedPermissions.includes(permission)}
                  onCheckedChange={(checked) => onChange(permission, !!checked)}
                  disabled={disabled}
                />
                <label
                  htmlFor={permission}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {PERMISSIONS[permission]}
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};