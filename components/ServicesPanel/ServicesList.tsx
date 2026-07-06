'use client';

import { Service, Lead } from '@/types';
import ServiceItem from './ServiceItem';
import AddServiceButton from './AddServiceButton';

interface ServicesListProps {
  services: Service[];
  leads: Lead[];
  selectedService: Service | null;
  isScanning: boolean;
  onSelect: (service: Service) => void;
  onAdd: () => void;
  onEdit: (service: Service) => void;
  onScanNow: (serviceId: string) => void;
  onDelete: (serviceId: string) => void;
}

export default function ServicesList({
  services, leads, selectedService, isScanning,
  onSelect, onAdd, onEdit, onScanNow, onDelete
}: ServicesListProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#1e2d4a]">
        <h3 className="text-sm font-semibold text-[#8899bb] uppercase tracking-wider">Services</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {services.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[#8899bb] text-sm">Add your first service to start finding leads →</p>
          </div>
        ) : (
          services.map(service => (
            <ServiceItem
              key={service.id}
              service={service}
              leadCount={leads.filter(l => l.service_id === service.id).length}
              isSelected={selectedService?.id === service.id}
              isScanning={isScanning && selectedService?.id === service.id}
              onSelect={() => onSelect(service)}
              onEdit={() => onEdit(service)}
              onScanNow={() => onScanNow(service.id)}
              onDelete={() => onDelete(service.id)}
            />
          ))
        )}
      </div>
      <div className="p-3 border-t border-[#1e2d4a]">
        <AddServiceButton onClick={onAdd} />
      </div>
    </div>
  );
}
