import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Search, Download, Trash2, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ContactGroupMember {
  id: string;
  phoneNumber: string;
  name: string | null;
  status: 'valid' | 'invalid' | 'duplicate';
  createdAt: string;
}

interface ContactGroup {
  id: string;
  name: string;
  description: string | null;
  totalContacts: number;
  validContacts: number;
  invalidContacts: number;
  duplicateContacts: number;
  createdAt: string;
}

export default function GroupContacts() {
  const [match, params] = useRoute('/group-contacts/:groupId');
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const queryClient = useQueryClient();

  const groupId = params?.groupId;

  // Fetch group details
  const { data: group, isLoading: groupLoading } = useQuery<ContactGroup>({
    queryKey: [`/api/contact-groups/${groupId}`],
    enabled: !!groupId,
  });

  // Fetch group members
  const { data: members = [], isLoading: membersLoading } = useQuery<ContactGroupMember[]>({
    queryKey: [`/api/contact-groups/${groupId}/members`],
    enabled: !!groupId,
  });

  // Delete selected members mutation
  const deleteSelectedMutation = useMutation({
    mutationFn: (memberIds: string[]) =>
      apiRequest(`/api/contact-groups/${groupId}/members/batch-delete`, "DELETE", { memberIds }),
    onSuccess: () => {
      toast({
        title: "Contacts Deleted",
        description: `${selectedContacts.length} contacts removed from group`,
      });
      setSelectedContacts([]);
      setSelectAll(false);
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete selected contacts",
        variant: "destructive",
      });
    },
  });

  // Import CSV mutation
  const importCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csv', file);
      const response = await fetch(`/api/contact-groups/${groupId}/import-csv`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import CSV');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import Successful",
        description: `Imported ${data.validContacts} valid contacts, ${data.duplicateContacts} duplicates found`,
      });
      // Force immediate refresh of both queries
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] });
      
      // Also refresh the contact groups list
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups`] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import contacts",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Reset the file input
      const fileInput = document.getElementById('csv-import') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  });

  const filteredMembers = members.filter(member =>
    member.phoneNumber.includes(searchTerm) ||
    (member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedContacts(filteredMembers.map(member => member.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts(prev => [...prev, contactId]);
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId));
      setSelectAll(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importCsvMutation.mutate(file);
    }
  };

  const exportContacts = () => {
    window.open(`/api/contact-groups/${groupId}/export`);
  };

  useEffect(() => {
    if (filteredMembers.length > 0 && selectedContacts.length === filteredMembers.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedContacts, filteredMembers]);

  if (!groupId) {
    setLocation('/');
    return null;
  }

  if (groupLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/dashboard?module=contact-groups')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{group?.name}</h1>
              <p className="text-muted-foreground">
                {group?.totalContacts} total contacts • {selectedContacts.length} selected
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileImport}
              className="hidden"
              id="csv-import"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('csv-import')?.click()}
              disabled={importCsvMutation.isPending}
              className="flex items-center space-x-2"
            >
              {importCsvMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Import CSV</span>
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={exportContacts}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </Button>
            
            <Button
              variant="destructive"
              onClick={() => deleteSelectedMutation.mutate(selectedContacts)}
              disabled={selectedContacts.length === 0 || deleteSelectedMutation.isPending}
              className="flex items-center space-x-2"
            >
              {deleteSelectedMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Search and Actions */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    Select All ({filteredMembers.length})
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Group Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 py-2 px-4 border-b font-medium text-sm text-muted-foreground">
                <div className="col-span-1">SELECT</div>
                <div className="col-span-1">NO.</div>
                <div className="col-span-4">PHONE NUMBER</div>
                <div className="col-span-3">NAME</div>
                <div className="col-span-2">VALID?</div>
                <div className="col-span-1">STATUS</div>
              </div>

              {/* Table Rows */}
              {filteredMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No contacts found</p>
                </div>
              ) : (
                filteredMembers.map((member, index) => (
                  <div
                    key={member.id}
                    className="grid grid-cols-12 gap-4 py-3 px-4 border-b hover:bg-muted/50 transition-colors"
                  >
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={selectedContacts.includes(member.id)}
                        onCheckedChange={(checked) => handleSelectContact(member.id, checked as boolean)}
                      />
                    </div>
                    <div className="col-span-1 flex items-center text-sm text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="col-span-4 flex items-center font-mono text-sm">
                      {member.phoneNumber}
                    </div>
                    <div className="col-span-3 flex items-center text-sm">
                      {member.name || '-'}
                    </div>
                    <div className="col-span-2 flex items-center">
                      {member.status === 'valid' ? (
                        <div className="flex items-center space-x-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Valid</span>
                        </div>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          {member.status}
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-1 flex items-center">
                      <Badge 
                        variant={member.status === 'valid' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {member.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}