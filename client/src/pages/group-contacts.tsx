import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Search, Download, Trash2, Upload, CheckCircle, Loader2, Plus, UserPlus, Users, FileText, Edit2 } from 'lucide-react';
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

// Country codes with validation rules
const countryData = [
  { code: "+91", country: "India", flag: "🇮🇳", minDigits: 10, maxDigits: 10 },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸", minDigits: 10, maxDigits: 10 },
  { code: "+44", country: "UK", flag: "🇬🇧", minDigits: 10, maxDigits: 11 },
  { code: "+49", country: "Germany", flag: "🇩🇪", minDigits: 10, maxDigits: 11 },
  { code: "+33", country: "France", flag: "🇫🇷", minDigits: 9, maxDigits: 9 },
  { code: "+61", country: "Australia", flag: "🇦🇺", minDigits: 9, maxDigits: 10 },
  { code: "+55", country: "Brazil", flag: "🇧🇷", minDigits: 10, maxDigits: 11 },
  { code: "+86", country: "China", flag: "🇨🇳", minDigits: 11, maxDigits: 11 },
  { code: "+81", country: "Japan", flag: "🇯🇵", minDigits: 10, maxDigits: 11 },
  { code: "+82", country: "South Korea", flag: "🇰🇷", minDigits: 9, maxDigits: 10 },
  { code: "+7", country: "Russia", flag: "🇷🇺", minDigits: 10, maxDigits: 10 },
  { code: "+52", country: "Mexico", flag: "🇲🇽", minDigits: 10, maxDigits: 10 },
  { code: "+62", country: "Indonesia", flag: "🇮🇩", minDigits: 10, maxDigits: 12 },
  { code: "+92", country: "Pakistan", flag: "🇵🇰", minDigits: 10, maxDigits: 10 },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩", minDigits: 10, maxDigits: 10 },
  { code: "+234", country: "Nigeria", flag: "🇳🇬", minDigits: 10, maxDigits: 10 },
  { code: "+27", country: "South Africa", flag: "🇿🇦", minDigits: 9, maxDigits: 10 },
  { code: "+90", country: "Turkey", flag: "🇹🇷", minDigits: 10, maxDigits: 10 },
  { code: "+20", country: "Egypt", flag: "🇪🇬", minDigits: 10, maxDigits: 10 },
  { code: "+63", country: "Philippines", flag: "🇵🇭", minDigits: 10, maxDigits: 10 },
  { code: "+54", country: "Argentina", flag: "🇦🇷", minDigits: 10, maxDigits: 11 },
  { code: "+60", country: "Malaysia", flag: "🇲🇾", minDigits: 9, maxDigits: 10 },
  { code: "+84", country: "Vietnam", flag: "🇻🇳", minDigits: 9, maxDigits: 10 },
  { code: "+66", country: "Thailand", flag: "🇹🇭", minDigits: 9, maxDigits: 9 },
  { code: "+971", country: "UAE", flag: "🇦🇪", minDigits: 9, maxDigits: 9 }
];

export default function GroupContacts() {
  const [match, params] = useRoute('/group-contacts/:groupId');
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddModeDialog, setShowAddModeDialog] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'multiple'>('single');
  const [newContact, setNewContact] = useState({ name: '', phoneNumber: '' });
  const [multipleNumbers, setMultipleNumbers] = useState('');
  const [multipleNumbersErrors, setMultipleNumbersErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState({ name: '', phoneNumber: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countryData[0]); // Default to India
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactGroupMember | null>(null);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editPhoneError, setEditPhoneError] = useState('');
  const queryClient = useQueryClient();

  const groupId = params?.groupId;

  // ⚡ Optimized group details fetching
  const { data: group, isLoading: groupLoading } = useQuery<ContactGroup>({
    queryKey: [`/api/contact-groups/${groupId}`],
    enabled: !!groupId,
    staleTime: 60000, // Cache for 1 minute instead of always refetch
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Disable focus refetch for performance
  });

  // ⚡ Smart group members caching
  const { data: members = [], isLoading: membersLoading } = useQuery<ContactGroupMember[]>({
    queryKey: [`/api/contact-groups/${groupId}/members`],
    enabled: !!groupId,
    staleTime: 30000, // Cache for 30 seconds - updates handled by mutations
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Disable focus refetch for better performance
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
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups`] });
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
      setIsImporting(true); // Set local importing state
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
      setIsImporting(false); // Clear importing state
      // Force immediate refresh of all related queries
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups`] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import contacts",
        variant: "destructive",
      });
      setIsImporting(false); // Clear importing state on error
    },
    onSettled: () => {
      // Reset the file input
      const fileInput = document.getElementById('csv-import') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  });

  // Add single contact mutation
  const addContactMutation = useMutation({
    mutationFn: (contactData: { name: string; phoneNumber: string }) =>
      apiRequest(`/api/contact-groups/${groupId}/members`, "POST", contactData),
    onSuccess: () => {
      toast({
        title: "Contact Added",
        description: "Contact saved successfully",
      });
      setShowAddDialog(false);
      setNewContact({ name: '', phoneNumber: '' });
      setValidationErrors({ name: '', phoneNumber: '' });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Contact",
        description: error?.message || "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  // Add multiple contacts mutation
  const addMultipleContactsMutation = useMutation({
    mutationFn: (phoneNumbers: string[]) =>
      apiRequest(`/api/contact-groups/${groupId}/members/batch`, "POST", { phoneNumbers }),
    onSuccess: (data: any) => {
      toast({
        title: "Contacts Added",
        description: `Successfully added ${data.validContacts} valid contacts${data.invalidContacts > 0 ? `, ${data.invalidContacts} invalid numbers` : ''}`,
      });
      setShowAddDialog(false);
      setMultipleNumbers('');
      setMultipleNumbersErrors([]);
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Contacts",
        description: error?.message || "Failed to add contacts",
        variant: "destructive",
      });
    },
  });

  // Edit contact mutation
  const editContactMutation = useMutation({
    mutationFn: (data: { memberId: string; phoneNumber: string; name?: string | null }) =>
      apiRequest(`/api/contact-groups/${groupId}/members/${data.memberId}`, "PATCH", { phoneNumber: data.phoneNumber, name: data.name }),
    onSuccess: () => {
      toast({
        title: "Contact Updated", 
        description: "Contact information updated successfully",
      });
      setShowEditDialog(false);
      setEditingContact(null);
      setEditPhoneNumber('');
      setEditPhoneError('');
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups/${groupId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contact-groups`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Contact",
        description: error?.message || "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  // Validation functions
  const validateName = (name: string): string => {
    if (!name.trim()) return 'Name is required';
    if (name.trim().length < 3) return 'Name must be at least 3 characters';
    if (name.trim().length > 15) return 'Name must be less than 15 characters';
    return '';
  };

  const validatePhoneNumber = (phone: string): string => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return 'Phone number is required';
    if (!/^\d+$/.test(cleanPhone)) return 'Phone number must contain only numbers';
    
    const { minDigits, maxDigits, country } = selectedCountry;
    if (minDigits === maxDigits) {
      if (cleanPhone.length !== minDigits) {
        return `Phone number must be exactly ${minDigits} digits for ${country}`;
      }
    } else {
      if (cleanPhone.length < minDigits || cleanPhone.length > maxDigits) {
        return `Phone number must be ${minDigits}-${maxDigits} digits for ${country}`;
      }
    }
    return '';
  };

  const validateMultiplePhoneNumbers = (numbers: string): string[] => {
    const errors: string[] = [];
    const lines = numbers.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if line contains country code (starts with + or contains country code pattern)
      if (!trimmedLine.startsWith('+') && !/^[\d\s\-\(\)]+$/.test(trimmedLine)) {
        errors.push(`Line ${index + 1}: "${trimmedLine}" must include a country code (e.g., +91, +1, +44)`);
        return;
      }
      
      // Extract country code and phone number
      let countryCode = '';
      let phoneNumber = '';
      
      if (trimmedLine.startsWith('+')) {
        const parts = trimmedLine.replace(/[\s\-\(\)]/g, '');
        const match = parts.match(/^\+(\d{1,4})(\d{9,12})$/);
        if (match) {
          countryCode = match[1];
          phoneNumber = match[2];
        } else {
          errors.push(`Line ${index + 1}: "${trimmedLine}" invalid format. Use: +countrycode followed by 9-12 digits`);
          return;
        }
      } else {
        errors.push(`Line ${index + 1}: "${trimmedLine}" must start with country code (+91, +1, +44, etc.)`);
        return;
      }
      
      // Validate phone number length (9-12 digits)
      if (phoneNumber.length < 9 || phoneNumber.length > 12) {
        errors.push(`Line ${index + 1}: "${trimmedLine}" phone number must be 9-12 digits (found ${phoneNumber.length})`);
        return;
      }
      
      // Validate only digits
      if (!/^\d+$/.test(phoneNumber)) {
        errors.push(`Line ${index + 1}: "${trimmedLine}" phone number must contain only digits`);
        return;
      }
    });
    
    return errors;
  };

  const formatMultiplePhoneNumbers = (numbers: string): string[] => {
    const lines = numbers.split('\n').filter(line => line.trim());
    const validNumbers: string[] = [];
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('+')) {
        const cleanPhone = trimmedLine.replace(/[\s\-\(\)]/g, '');
        const match = cleanPhone.match(/^\+(\d{1,4})(\d{9,12})$/);
        if (match) {
          const countryCode = match[1];
          const phoneNumber = match[2];
          if (phoneNumber.length >= 9 && phoneNumber.length <= 12) {
            validNumbers.push(`+${countryCode}${phoneNumber}`);
          }
        }
      }
    });
    
    return validNumbers;
  };

  // Edit phone validation (accepts numbers with country codes, 9-12 digits)
  const validateEditPhoneNumber = (phone: string): string => {
    if (!phone.trim()) return 'Phone number is required';
    
    // Must start with country code
    if (!phone.startsWith('+')) {
      return 'Phone number must start with country code (e.g., +91, +1, +44)';
    }
    
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const match = cleanPhone.match(/^\+(\d{1,4})(\d{9,12})$/);
    if (!match) {
      return 'Invalid format. Use: +[country code][9-12 digits]';
    }
    
    const phoneNumber = match[2];
    if (phoneNumber.length < 9 || phoneNumber.length > 12) {
      return `Phone number must be 9-12 digits (found ${phoneNumber.length})`;
    }
    
    return '';
  };

  const handleAddContact = () => {
    if (addMode === 'single') {
      const nameError = validateName(newContact.name);
      const phoneError = validatePhoneNumber(newContact.phoneNumber);
      
      setValidationErrors({ name: nameError, phoneNumber: phoneError });
      
      if (!nameError && !phoneError) {
        // Format phone number with selected country code
        const formattedPhone = selectedCountry.code + newContact.phoneNumber.replace(/[^0-9]/g, '');
        
        addContactMutation.mutate({
          name: newContact.name.trim(),
          phoneNumber: formattedPhone
        });
      }
    } else {
      // Multiple numbers mode
      const errors = validateMultiplePhoneNumbers(multipleNumbers);
      setMultipleNumbersErrors(errors);
      
      if (errors.length === 0 && multipleNumbers.trim()) {
        const validNumbers = formatMultiplePhoneNumbers(multipleNumbers);
        if (validNumbers.length > 0) {
          addMultipleContactsMutation.mutate(validNumbers);
        } else {
          toast({
            title: "No Valid Numbers",
            description: "Please enter at least one valid phone number",
            variant: "destructive",
          });
        }
      } else if (!multipleNumbers.trim()) {
        toast({
          title: "No Numbers Entered",
          description: "Please enter phone numbers",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditContact = (contact: ContactGroupMember) => {
    setEditingContact(contact);
    setEditPhoneNumber(contact.phoneNumber);
    setEditPhoneError('');
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    const error = validateEditPhoneNumber(editPhoneNumber);
    setEditPhoneError(error);
    
    if (!error && editingContact) {
      editContactMutation.mutate({
        memberId: editingContact.id,
        phoneNumber: editPhoneNumber.trim(),
        name: editingContact.name?.trim() || null
      });
    }
  };

  const handleEditDialogClose = () => {
    setShowEditDialog(false);
    setEditingContact(null);
    setEditPhoneNumber('');
    setEditPhoneError('');
  };

  const handleDialogClose = () => {
    setShowAddDialog(false);
    setShowAddModeDialog(false);
    setAddMode('single');
    setNewContact({ name: '', phoneNumber: '' });
    setMultipleNumbers('');
    setMultipleNumbersErrors([]);
    setValidationErrors({ name: '', phoneNumber: '' });
    setSelectedCountry(countryData[0]); // Reset to default country (India)
  };

  const handleAddModeSelect = (mode: 'single' | 'multiple') => {
    setAddMode(mode);
    setShowAddModeDialog(false);
    setShowAddDialog(true);
  };

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
      <div className="max-w-none lg:max-w-6xl mx-auto p-3 sm:p-6">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/dashboard?module=contact-groups')}
              className="flex items-center space-x-2 flex-shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{group?.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {group?.totalContacts} total • {selectedContacts.length} selected
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:space-x-2">
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
              disabled={isImporting}
              className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
              data-testid="button-import-csv"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden sm:inline">Importing...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Import CSV</span>
                  <span className="sm:hidden">Import</span>
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={exportContacts}
              className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
              data-testid="button-export-csv"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>

            <Button
              variant="default"
              onClick={() => setShowAddModeDialog(true)}
              className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
              data-testid="button-add-contact"
            >
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden lg:inline">Add Contact</span>
              <span className="lg:hidden">Add</span>
            </Button>
            
            <Button
              variant="destructive"
              onClick={() => deleteSelectedMutation.mutate(selectedContacts)}
              disabled={selectedContacts.length === 0 || deleteSelectedMutation.isPending}
              className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
              data-testid="button-delete-selected"
            >
              {deleteSelectedMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden sm:inline">Deleting...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Delete</span>
                  <span className="lg:hidden">Del</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Search - Mobile Responsive */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-2 sm:space-x-4 flex-1">
                <div className="relative flex-1 max-w-none sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm sm:text-base"
                    data-testid="input-search-contacts"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Table - Mobile Responsive */}
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
            <CardTitle className="text-lg sm:text-xl">Group Contacts</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-3 sm:space-y-4">
              {/* Select All Section */}
              <div className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-muted/30 rounded-lg">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <label htmlFor="select-all" className="text-xs sm:text-sm font-medium">
                  Select All ({filteredMembers.length})
                </label>
              </div>

              {/* Table Header - Hidden on Mobile, Card Layout Used Instead */}
              <div className="hidden sm:grid grid-cols-12 gap-2 py-2 px-4 border-b font-medium text-xs sm:text-sm text-muted-foreground text-center">
                <div className="col-span-1">SELECT</div>
                <div className="col-span-1">ID</div>
                <div className="col-span-4">NAME</div>
                <div className="col-span-5">PHONE NUMBER</div>
                <div className="col-span-1">EDIT</div>
              </div>

              {/* Table Rows - Responsive Cards on Mobile, Table on Desktop */}
              {filteredMembers.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <Users className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                  <p className="text-sm sm:text-base text-muted-foreground">No contacts found</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-0">
                  {filteredMembers.map((member, index) => (
                    <div key={member.id}>
                      {/* Mobile Card Layout */}
                      <div className="sm:hidden border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between space-x-3">
                          <div className="flex items-start space-x-2 flex-1 min-w-0">
                            <Checkbox
                              checked={selectedContacts.includes(member.id)}
                              onCheckedChange={(checked) => handleSelectContact(member.id, checked as boolean)}
                              className="mt-1 flex-shrink-0"
                              data-testid={`checkbox-contact-${member.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="font-medium text-sm truncate">{member.name || 'Unknown'}</p>
                                <Badge 
                                  variant={member.status === 'valid' ? 'default' : member.status === 'invalid' ? 'destructive' : 'secondary'}
                                  className="text-xs flex-shrink-0"
                                >
                                  {member.status}
                                </Badge>
                              </div>
                              <p className="text-xs font-mono text-muted-foreground break-all">{member.phoneNumber}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Added {new Date(member.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditContact(member)}
                            className="flex-shrink-0 p-2"
                            data-testid={`button-edit-contact-${member.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Desktop Table Layout */}
                      <div className="hidden sm:grid grid-cols-12 gap-2 py-3 px-4 border-b hover:bg-muted/50 transition-colors">
                        <div className="col-span-1 flex items-center justify-center">
                          <Checkbox
                            checked={selectedContacts.includes(member.id)}
                            onCheckedChange={(checked) => handleSelectContact(member.id, checked as boolean)}
                            data-testid={`checkbox-contact-${member.id}`}
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center text-sm text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="col-span-4 flex items-center justify-center text-sm">
                          {member.name || '-'}
                        </div>
                        <div className="col-span-5 flex items-center justify-center font-mono text-sm">
                          {member.phoneNumber}
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditContact(member)}
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                            data-testid={`button-edit-contact-${member.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Mode Selection Dialog */}
        <Dialog open={showAddModeDialog} onOpenChange={setShowAddModeDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Choose Add Contact Method</DialogTitle>
              <DialogDescription>
                Select how you want to add contacts to this group
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center space-y-2 hover:bg-primary/5"
                  onClick={() => handleAddModeSelect('single')}
                >
                  <UserPlus className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">Single Contact</div>
                    <div className="text-xs text-muted-foreground">Add one contact with name</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col items-center space-y-2 hover:bg-primary/5"
                  onClick={() => handleAddModeSelect('multiple')}
                >
                  <Users className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">Multiple Numbers</div>
                    <div className="text-xs text-muted-foreground">Add multiple phone numbers</div>
                  </div>
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModeDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Contact Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className={addMode === 'multiple' ? "sm:max-w-2xl" : "sm:max-w-md"}>
            <DialogHeader>
              <DialogTitle>
                {addMode === 'single' ? 'Add Single Contact' : 'Add Multiple Numbers'}
              </DialogTitle>
              {addMode === 'multiple' && (
                <DialogDescription>
                  Country code is mandatory! Enter phone numbers with country codes (+91, +1, +44, etc.) followed by 9-12 digits.
                </DialogDescription>
              )}
            </DialogHeader>
            
            <div className="space-y-4">
              {addMode === 'single' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter contact name"
                      value={newContact.name}
                      onChange={(e) => {
                        setNewContact(prev => ({ ...prev, name: e.target.value }));
                        if (validationErrors.name) {
                          setValidationErrors(prev => ({ ...prev, name: validateName(e.target.value) }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          document.getElementById('phoneNumber')?.focus();
                        }
                      }}
                      className={validationErrors.name ? 'border-red-500' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-red-500">{validationErrors.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <div className="flex space-x-2">
                      {/* Country Code Dropdown */}
                      <Select 
                        value={selectedCountry.code} 
                        onValueChange={(value) => {
                          const country = countryData.find(c => c.code === value);
                          if (country) {
                            setSelectedCountry(country);
                            // Clear phone number and validation errors when country changes
                            setNewContact(prev => ({ ...prev, phoneNumber: '' }));
                            setValidationErrors(prev => ({ ...prev, phoneNumber: '' }));
                          }
                        }}
                      >
                        <SelectTrigger className="w-32 flex-shrink-0">
                          <SelectValue>
                            <div className="flex items-center space-x-2">
                              <span>{selectedCountry.flag}</span>
                              <span className="text-sm">{selectedCountry.code}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {countryData.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              <div className="flex items-center space-x-3">
                                <span>{country.flag}</span>
                                <span className="font-medium">{country.code}</span>
                                <span className="text-sm text-muted-foreground">{country.country}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Phone Number Input */}
                      <Input
                        id="phoneNumber"
                        placeholder={`Enter ${selectedCountry.minDigits === selectedCountry.maxDigits 
                          ? selectedCountry.minDigits 
                          : `${selectedCountry.minDigits}-${selectedCountry.maxDigits}`}-digit phone number`}
                        value={newContact.phoneNumber}
                        onChange={(e) => {
                          // Only allow numbers
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          setNewContact(prev => ({ ...prev, phoneNumber: value }));
                          if (validationErrors.phoneNumber) {
                            setValidationErrors(prev => ({ ...prev, phoneNumber: validatePhoneNumber(value) }));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddContact();
                          }
                        }}
                        maxLength={selectedCountry.maxDigits}
                        className={`flex-1 ${validationErrors.phoneNumber ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {validationErrors.phoneNumber && (
                      <p className="text-sm text-red-500">{validationErrors.phoneNumber}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="multipleNumbers">Phone Numbers</Label>
                  <Textarea
                    id="multipleNumbers"
                    placeholder={`Country code is mandatory! Enter phone numbers with country codes, one per line:
+919384938438
+1234567890
+447123456789
+49123456789
+33123456789

Format: +[country code][9-12 digits]
Valid examples: +91xxxxxxxxxx, +1xxxxxxxxxx, +44xxxxxxxxxxx

Press Ctrl+Enter to save`}
                    value={multipleNumbers}
                    onChange={(e) => {
                      setMultipleNumbers(e.target.value);
                      // Clear errors when user starts typing
                      if (multipleNumbersErrors.length > 0) {
                        const newErrors = validateMultiplePhoneNumbers(e.target.value);
                        setMultipleNumbersErrors(newErrors);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleAddContact();
                      }
                    }}
                    className={`min-h-[200px] font-mono text-sm ${multipleNumbersErrors.length > 0 ? 'border-red-500' : ''}`}
                  />
                  {multipleNumbersErrors.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {multipleNumbersErrors.map((error, index) => (
                        <p key={index} className="text-sm text-red-500">{error}</p>
                      ))}
                    </div>
                  )}
                  {multipleNumbers.trim() && multipleNumbersErrors.length === 0 && (
                    <p className="text-sm text-green-600">
                      ✓ {formatMultiplePhoneNumbers(multipleNumbers).length} valid numbers detected
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddContact}
                disabled={
                  addMode === 'single' 
                    ? addContactMutation.isPending 
                    : addMultipleContactsMutation.isPending
                }
                className="flex items-center space-x-2"
              >
                {(addMode === 'single' ? addContactMutation.isPending : addMultipleContactsMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>{addMode === 'single' ? 'Add Contact' : 'Add Numbers'}</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog open={showEditDialog} onOpenChange={handleEditDialogClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>
                Update the contact name and phone number. Format: +[country code][9-12 digits]
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Name</Label>
                <Input
                  id="editName"
                  placeholder="Enter contact name (optional)"
                  value={editingContact?.name || ''}
                  onChange={(e) => setEditingContact(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('editPhoneNumber')?.focus();
                    }
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editPhoneNumber">Phone Number</Label>
                <Input
                  id="editPhoneNumber"
                  placeholder="Enter phone number with country code (e.g., +919876543210)"
                  value={editPhoneNumber}
                  onChange={(e) => {
                    setEditPhoneNumber(e.target.value);
                    if (editPhoneError) {
                      setEditPhoneError(validateEditPhoneNumber(e.target.value));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                  }}
                  className={editPhoneError ? 'border-red-500' : ''}
                />
                {editPhoneError && (
                  <p className="text-sm text-red-500">{editPhoneError}</p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleEditDialogClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={editContactMutation.isPending}
                className="flex items-center space-x-2"
              >
                {editContactMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}