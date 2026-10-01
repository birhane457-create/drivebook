import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { profileAPI } from '../services/api';

interface ServiceArea {
  id: string;
  postcode: string;
  suburb: string;
  state: string;
}

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [carImage, setCarImage] = useState<string | null>(null);
  const [newPostcode, setNewPostcode] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    bio: '',
    carMake: '',
    carModel: '',
    carYear: '',
    hourlyRate: '',
    serviceRadiusKm: '',
    baseAddress: '',
    licenseNumber: '',
    insuranceNumber: '',
    vehicleTypes: [] as string[],
    languages: [] as string[],
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await profileAPI.get();
      const data = response.data;
      
      setFormData({
        name: data.name || '',
        phone: data.phone || '',
        bio: data.bio || '',
        carMake: data.carMake || '',
        carModel: data.carModel || '',
        carYear: data.carYear?.toString() || '',
        hourlyRate: data.hourlyRate?.toString() || '',
        serviceRadiusKm: data.serviceRadiusKm?.toString() || '',
        baseAddress: data.baseAddress || '',
        licenseNumber: data.licenseNumber || '',
        insuranceNumber: data.insuranceNumber || '',
        vehicleTypes: data.vehicleTypes || [],
        languages: data.languages || [],
      });

      // set images if provided
      setProfileImage(data.profileImage || null);
      setCarImage(data.carImage || null);

      // Load service areas
      const areasResponse = await profileAPI.getServiceAreas();
      setServiceAreas(areasResponse.data);
    } catch (error: any) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUpload = async (type: 'profileImage' | 'carImage') => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please grant photo permissions to upload images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.7,
        allowsEditing: true,
      });

      if (result.cancelled) return;

      const base64 = `data:image/jpeg;base64,${result.base64}`;
      const res = await profileAPI.uploadDocument(type, base64);
      if (res.data?.url) {
        if (type === 'profileImage') setProfileImage(res.data.url);
        else setCarImage(res.data.url);
        Alert.alert('Success', 'Image uploaded');
      } else if (res.data?.success && res.data.url) {
        if (type === 'profileImage') setProfileImage(res.data.url);
        else setCarImage(res.data.url);
        Alert.alert('Success', 'Image uploaded');
      } else {
        Alert.alert('Upload error', 'Failed to upload image');
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }

    try {
      setSaving(true);
      await profileAPI.update({
        name: formData.name,
        phone: formData.phone,
        bio: formData.bio,
        carMake: formData.carMake,
        carModel: formData.carModel,
        carYear: formData.carYear ? parseInt(formData.carYear) : null,
      });
      
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const addServiceArea = async () => {
    if (!newPostcode.trim()) {
      Alert.alert('Error', 'Please enter a postcode');
      return;
    }

    try {
      const response = await profileAPI.addServiceArea(newPostcode);
      setServiceAreas([...serviceAreas, response.data]);
      setNewPostcode('');
      Alert.alert('Success', 'Service area added');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to add service area');
    }
  };

  const removeServiceArea = async (id: string) => {
    Alert.alert(
      'Remove Service Area',
      'Are you sure you want to remove this service area?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await profileAPI.removeServiceArea(id);
              setServiceAreas(serviceAreas.filter(area => area.id !== id));
            } catch (error) {
              Alert.alert('Error', 'Failed to remove service area');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Basic Information */}
      <View style={styles.section}>
        {/* Images */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={{ alignItems: 'center' }}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: 96, height: 96, borderRadius: 48 }} />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#6B7280' }}>Photo</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.addButton, { marginTop: 8, paddingHorizontal: 12 }]} onPress={() => pickAndUpload('profileImage')}>
              <Text style={styles.addButtonText}>Upload Photo</Text>
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'center' }}>
            {carImage ? (
              <Image source={{ uri: carImage }} style={{ width: 140, height: 96, borderRadius: 8 }} />
            ) : (
              <View style={{ width: 140, height: 96, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#6B7280' }}>Car</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.addButton, { marginTop: 8, paddingHorizontal: 12 }]} onPress={() => pickAndUpload('carImage')}>
              <Text style={styles.addButtonText}>Upload Car Photo</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter your full name"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone *</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.bio}
            onChangeText={(text) => setFormData({ ...formData, bio: text })}
            placeholder="Tell clients about yourself, your experience, teaching style..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Car Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Car Information</Text>
        
        <View style={styles.row}>
          <View style={[styles.field, styles.fieldHalf]}>
            <Text style={styles.label}>Make</Text>
            <TextInput
              style={styles.input}
              value={formData.carMake}
              onChangeText={(text) => setFormData({ ...formData, carMake: text })}
              placeholder="Toyota"
            />
          </View>

          <View style={[styles.field, styles.fieldHalf]}>
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              value={formData.carModel}
              onChangeText={(text) => setFormData({ ...formData, carModel: text })}
              placeholder="Corolla"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={formData.carYear}
            onChangeText={(text) => setFormData({ ...formData, carYear: text })}
            placeholder="2020"
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Business Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Business Information</Text>
        
        <View style={styles.row}>
          <View style={[styles.field, styles.fieldHalf]}>
            <Text style={styles.label}>Hourly Rate ($)</Text>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={formData.hourlyRate}
              editable={false}
            />
            <Text style={styles.hint}>Change in Settings</Text>
          </View>

          <View style={[styles.field, styles.fieldHalf]}>
            <Text style={styles.label}>Service Radius (km)</Text>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={formData.serviceRadiusKm}
              editable={false}
            />
            <Text style={styles.hint}>Change in Settings</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Base Address</Text>
          <TextInput
            style={[styles.input, styles.inputReadOnly]}
            value={formData.baseAddress}
            editable={false}
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Vehicle Types</Text>
          <View style={styles.tags}>
            {formData.vehicleTypes.map((type) => (
              <View key={type} style={[styles.tag, styles.tagBlue]}>
                <Text style={styles.tagText}>{type}</Text>
              </View>
            ))}
            {formData.vehicleTypes.length === 0 && (
              <Text style={styles.emptyText}>No vehicle types set</Text>
            )}
          </View>
          <Text style={styles.hint}>Change in Settings</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Languages</Text>
          <View style={styles.tags}>
            {formData.languages.map((lang) => (
              <View key={lang} style={[styles.tag, styles.tagGreen]}>
                <Text style={styles.tagText}>{lang}</Text>
              </View>
            ))}
            {formData.languages.length === 0 && (
              <Text style={styles.emptyText}>No languages set</Text>
            )}
          </View>
        </View>
      </View>

      {/* Professional Credentials */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Professional Credentials</Text>
        
        <View style={styles.field}>
          <Text style={styles.label}>Instructor License Number</Text>
          <TextInput
            style={[styles.input, styles.inputReadOnly]}
            value={formData.licenseNumber}
            editable={false}
            placeholder="Not provided"
          />
          {!formData.licenseNumber && (
            <Text style={styles.warning}>⚠️ Not provided - complete your profile</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Insurance Policy Number</Text>
          <TextInput
            style={[styles.input, styles.inputReadOnly]}
            value={formData.insuranceNumber}
            editable={false}
            placeholder="Not provided"
          />
          {!formData.insuranceNumber && (
            <Text style={styles.warning}>⚠️ Not provided - complete your profile</Text>
          )}
        </View>

        {(!formData.licenseNumber || !formData.insuranceNumber) && (
          <View style={styles.warningBox}>
            <Text style={styles.warningBoxText}>
              Complete your professional credentials to increase trust with students.
            </Text>
          </View>
        )}
      </View>

      {/* Service Areas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Service Areas (Postcodes)</Text>
        
        <View style={styles.addArea}>
          <TextInput
            style={[styles.input, styles.addAreaInput]}
            value={newPostcode}
            onChangeText={setNewPostcode}
            placeholder="Enter postcode (e.g., 6051)"
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={addServiceArea}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.areas}>
          {serviceAreas.map((area) => (
            <View key={area.id} style={styles.areaTag}>
              <Text style={styles.areaPostcode}>{area.postcode}</Text>
              {area.suburb && (
                <Text style={styles.areaSuburb}>({area.suburb})</Text>
              )}
              <TouchableOpacity
                onPress={() => removeServiceArea(area.id)}
                style={styles.areaRemove}
              >
                <Text style={styles.areaRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {serviceAreas.length === 0 && (
            <Text style={styles.emptyText}>No service areas added yet</Text>
          )}
        </View>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : '💾 Save Profile'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldHalf: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputReadOnly: {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  warning: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  warningBoxText: {
    fontSize: 13,
    color: '#92400E',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagBlue: {
    backgroundColor: '#DBEAFE',
  },
  tagGreen: {
    backgroundColor: '#D1FAE5',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  addArea: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addAreaInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  areas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  areaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  areaPostcode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  areaSuburb: {
    fontSize: 12,
    color: '#3B82F6',
  },
  areaRemove: {
    padding: 4,
  },
  areaRemoveText: {
    fontSize: 16,
    color: '#EF4444',
  },
  saveButton: {
    backgroundColor: '#2563EB',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});
