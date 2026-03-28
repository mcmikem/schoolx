'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useAcademic } from '@/lib/academic-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon}</span>
}

interface SchoolSettings {
  sms_notifications: boolean
  attendance_alerts: boolean
  fee_reminders: boolean
  attendance_threshold: number
  grade_threshold: number
  fee_threshold: number
}

export default function SettingsPage() {
  const { school, user, refreshSchool } = useAuth()
  const { academicYear, currentTerm, setAcademicYear, setCurrentTerm } = useAcademic()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<Array<{id: string, full_name: string, phone: string, role: string, is_active: boolean}>>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', phone: '', role: 'teacher', password: '' })
  const [settings, setSettings] = useState<SchoolSettings>({
    sms_notifications: true,
    attendance_alerts: true,
    fee_reminders: false,
    attendance_threshold: 80,
    grade_threshold: 50,
    fee_threshold: 50000
  })
  const [schoolData, setSchoolData] = useState({
    name: school?.name || '',
    district: school?.district || '',
    subcounty: '',
    phone: '',
    email: '',
  })
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [storageStatus, setStorageStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')

  // Test storage connectivity - uses server-side API to create bucket
  const testStorage = async () => {
    try {
      setStorageStatus('unknown')
      toast.info('Testing storage connection...')
      
      // First check via server API
      const response = await fetch('/api/storage', { method: 'GET' })
      const result = await response.json()
      
      console.log('Storage check:', result)
      
      if (result.success) {
        if (result.exists) {
          setStorageStatus('ok')
          toast.success('Storage bucket exists!')
        } else {
          // Try to create via API
          toast.info('Creating bucket...')
          const createResponse = await fetch('/api/storage', { method: 'POST' })
          const createResult = await createResponse.json()
          
          if (createResult.success) {
            setStorageStatus('ok')
            toast.success('Storage bucket created!')
          } else {
            setStorageStatus('error')
            toast.error(`Failed: ${createResult.error}`)
          }
        }
      } else {
        setStorageStatus('error')
        toast.error(result.error || 'Storage error')
      }
    } catch (err) {
      console.error('Storage test exception:', err)
      setStorageStatus('error')
      toast.error('Failed to connect to storage')
    }
  }

  useEffect(() => {
    if (school?.id) {
      fetchSettings()
    }
  }, [school?.id])

  const fetchSettings = async () => {
    if (!school?.id) return
    try {
      const { data } = await supabase
        .from('school_settings')
        .select('key, value')
        .eq('school_id', school.id)
      
      if (data) {
        const settingsMap: Record<string, string> = {}
        data.forEach((s: {key: string, value: string}) => {
          settingsMap[s.key] = s.value
        })
        setSettings(prev => ({
          ...prev,
          sms_notifications: settingsMap.sms_notifications !== 'false',
          attendance_alerts: settingsMap.attendance_alerts !== 'false',
          fee_reminders: settingsMap.fee_reminders === 'true',
          attendance_threshold: parseInt(settingsMap.attendance_threshold) || 80,
          grade_threshold: parseInt(settingsMap.grade_threshold) || 50,
          fee_threshold: parseInt(settingsMap.fee_threshold) || 50000
        }))
      }
      
      // Fetch school logo
      const { data: schoolData } = await supabase
        .from('schools')
        .select('logo_url')
        .eq('id', school.id)
        .single()
      
      if (schoolData?.logo_url) {
        setLogoUrl(schoolData.logo_url)
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  // Compress image file
  const compressImage = async (file: File, maxWidth = 400, maxHeight = 400): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        let { width, height } = img
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }
        
        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
          } else {
            resolve(file)
          }
        }, 'image/jpeg', 0.8)
      }
      
      img.src = URL.createObjectURL(file)
    })
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !school?.id) return
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }
    
    setUploadingLogo(true)
    try {
      // Check if bucket exists, create if not
      const bucketCheck = await fetch('/api/storage', { method: 'GET' })
      const bucketResult = await bucketCheck.json()
      
      if (!bucketResult.exists) {
        toast.info('Setting up storage...')
        await fetch('/api/storage', { method: 'POST' })
      }
      
      // Compress image first
      toast.info('Processing image...')
      const compressedFile = await compressImage(file)
      
      const fileExt = 'jpg'
      const fileName = `${school.id}-logo.${fileExt}`
      
      console.log('Starting upload to bucket...')
      
      // Try to upload
      let uploadData = await supabase.storage
        .from('school-logos')
        .upload(fileName, compressedFile, { 
          upsert: true,
          contentType: 'image/jpeg'
        })
      
      console.log('Upload result:', uploadData)
      
      let { data, error } = uploadData
      
      // If bucket doesn't exist, try to create it
      if (error && error.message.includes('bucket')) {
        console.log('Bucket not found, attempting to create...')
        await supabase.storage.createBucket('school-logos', {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
        })
        
        // Retry upload
        uploadData = await supabase.storage
          .from('school-logos')
          .upload(fileName, compressedFile, { 
            upsert: true,
            contentType: 'image/jpeg'
          })
        
        data = uploadData.data
        error = uploadData.error
      }
      
      if (error) {
        console.error('Storage error:', error)
        toast.error(`Upload failed: ${error.message}`)
        throw error
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('school-logos')
        .getPublicUrl(fileName)
      
      // Update school record
      const { error: updateError } = await supabase
        .from('schools')
        .update({ logo_url: publicUrl })
        .eq('id', school.id)
      
      if (updateError) {
        console.error('Update error:', updateError)
      } else {
        await refreshSchool()
      }
      
      setLogoUrl(publicUrl)
      toast.success('Logo uploaded successfully')
    } catch (err) {
      console.error('Logo upload error:', err)
      // More helpful error message
      toast.error('Failed to upload logo. Check console for details.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const saveSettings = async (key: string, value: string) => {
    if (!school?.id) return
    try {
      await supabase
        .from('school_settings')
        .upsert({ school_id: school.id, key, value }, { onConflict: 'school_id,key' })
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleSettingChange = async (key: keyof SchoolSettings, value: boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await saveSettings(key, String(value))
  }

  const exportAllData = async () => {
    if (!school?.id) return
    try {
      toast.success('Preparing export...')
      
      const tables = ['students', 'classes', 'subjects', 'attendance', 'grades', 'fee_structure', 'fee_payments', 'users']
      const allData: Record<string, unknown[]> = {}
      
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*').eq('school_id', school.id)
        if (data) allData[table] = data
      }
      
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `omuto_backup_${school.name}_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch (err) {
      toast.error('Export failed')
    }
  }

  useEffect(() => {
    if (school) {
      setSchoolData(prev => ({
        ...prev,
        name: school.name || '',
        district: school.district || '',
      }))
    }
  }, [school])

  useEffect(() => {
    if (activeTab === 'users' && school?.id) {
      fetchUsers()
    }
  }, [activeTab, school?.id])

  const fetchUsers = async () => {
    if (!school?.id) return
    try {
      setLoadingUsers(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('school_id', school.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const saveSchoolSettings = async () => {
    if (!school?.id) return
    try {
      setSaving(true)
      const { error } = await supabase
        .from('schools')
        .update({
          name: schoolData.name,
          district: schoolData.district,
          phone: schoolData.phone || null,
          email: schoolData.email || null,
        })
        .eq('id', school.id)
      if (error) throw error
      toast.success('Settings saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', id)
      if (error) throw error
      setUsers(users.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u))
      toast.success(currentStatus ? 'User deactivated' : 'User activated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return
    try {
      const normalizedPhone = newUser.phone.replace(/[^0-9]/g, '')
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: school.id,
          fullName: newUser.full_name,
          phone: normalizedPhone,
          password: newUser.password,
          role: newUser.role
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to add user')
      }

      toast.success('User added successfully')
      setShowAddUser(false)
      setNewUser({ full_name: '', phone: '', role: 'teacher', password: '' })
      fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add user')
    }
  }

  const tabs = [
    { key: 'general', label: 'School Details', icon: 'business' },
    { key: 'users', label: 'Staff & Users', icon: 'group' },
    { key: 'notifications', label: 'Notifications', icon: 'notifications' },
    { key: 'backup', label: 'Backup & Export', icon: 'backup' },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">Settings</h1>
        <p className="text-[#5c6670] mt-1">Manage your school settings</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-2 mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key 
                  ? 'bg-[#002045] text-white' 
                  : 'text-[#5c6670] hover:bg-[#f8fafb]'
              }`}
            >
              <MaterialIcon icon={tab.icon} className="text-lg" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-[#191c1d] mb-6">School Logo</h2>
          <div className="flex items-center gap-6 mb-6">
            <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50">
              {logoUrl ? (
                <img src={logoUrl} alt="School Logo" className="w-full h-full object-contain" />
              ) : (
                <MaterialIcon className="text-4xl text-gray-300">school</MaterialIcon>
              )}
            </div>
            <div>
              <label className="btn btn-secondary cursor-pointer">
                <MaterialIcon icon="upload" className="text-lg" />
                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoUpload} 
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 5MB - Auto-compressed</p>
              <button 
                onClick={testStorage} 
                className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {storageStatus === 'ok' ? '✅ Storage OK' : storageStatus === 'error' ? '❌ Storage Error' : '🧪 Test Storage'}
              </button>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-[#191c1d] mb-6">School Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">School Name</label>
              <input
                type="text"
                value={schoolData.name}
                onChange={(e) => setSchoolData({...schoolData, name: e.target.value})}
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">District</label>
                <input
                  type="text"
                  value={schoolData.district}
                  onChange={(e) => setSchoolData({...schoolData, district: e.target.value})}
                  className="input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Sub-county</label>
                <input
                  type="text"
                  value={schoolData.subcounty}
                  onChange={(e) => setSchoolData({...schoolData, subcounty: e.target.value})}
                  className="input"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone</label>
                <input
                  type="tel"
                  value={schoolData.phone}
                  onChange={(e) => setSchoolData({...schoolData, phone: e.target.value})}
                  className="input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Email</label>
                <input
                  type="email"
                  value={schoolData.email}
                  onChange={(e) => setSchoolData({...schoolData, email: e.target.value})}
                  className="input"
                />
              </div>
            </div>
            <div className="pt-4">
              <button onClick={saveSchoolSettings} disabled={saving} className="btn btn-primary">
                <MaterialIcon icon="save" className="text-lg" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl mt-6">
          <h2 className="text-lg font-semibold text-[#191c1d] mb-6 flex items-center gap-2">
            <MaterialIcon icon="calendar_month" className="text-primary" />
            Academic Configuration
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            Set the active academic year and term for the entire school. This controls all dashboards, fee reports, and grade books.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">Active Academic Year</label>
              <select 
                value={academicYear} 
                onChange={(e) => setAcademicYear(e.target.value)}
                className="input w-full"
              >
                {Array.from({length: 5}).map((_, i) => {
                  const year = new Date().getFullYear() - 2 + i;
                  return <option key={year} value={year.toString()}>{year}</option>
                })}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#191c1d] mb-2 block">Current Term</label>
              <select 
                value={currentTerm}
                onChange={(e) => setCurrentTerm(Number(e.target.value) as 1|2|3)}
                className="input w-full"
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => setShowAddUser(true)} className="btn btn-primary">
              <MaterialIcon icon="person_add" className="text-lg" />
              Add User
            </button>
          </div>

          {loadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#f0f4f8] rounded-full" />
                    <div className="flex-1">
                      <div className="w-32 h-4 bg-[#e8eaed] rounded mb-2" />
                      <div className="w-24 h-3 bg-[#e8eaed] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#f0f4f8] rounded-full flex items-center justify-center">
                        <span className="text-[#002045] font-semibold">
                          {u.full_name?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-[#191c1d]">{u.full_name}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[#e8f5e9] text-[#006e1c]">
                            {u.role === 'dos' ? 'Director of Studies' : u.role === 'school_admin' ? 'Administrator' : u.role === 'bursar' ? 'Bursar' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </span>
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${u.is_active ? 'bg-[#e8f5e9] text-[#006e1c]' : 'bg-[#fef2f2] text-[#ba1a1a]'}`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleUserStatus(u.id, u.is_active)}
                      className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-primary'}`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-[#191c1d] mb-6">Notification Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#e8eaed]">
                <div>
                  <div className="font-medium text-[#191c1d]">SMS Notifications</div>
                  <div className="text-sm text-[#5c6670]">Send SMS to parents for fee reminders</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.sms_notifications}
                    onChange={(e) => handleSettingChange('sms_notifications', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-[#e8eaed] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002045]"></div>
                </label>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[#e8eaed]">
                <div>
                  <div className="font-medium text-[#191c1d]">Attendance Alerts</div>
                  <div className="text-sm text-[#5c6670]">Notify when student is absent</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.attendance_alerts}
                    onChange={(e) => handleSettingChange('attendance_alerts', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-[#e8eaed] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002045]"></div>
                </label>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-[#191c1d]">Fee Reminders</div>
                  <div className="text-sm text-[#5c6670]">Send automatic fee balance reminders</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.fee_reminders}
                    onChange={(e) => handleSettingChange('fee_reminders', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-[#e8eaed] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#002045]"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-[#191c1d] mb-6">Warning Thresholds</h2>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Attendance Rate Threshold (%)</label>
                <p className="text-sm text-[#5c6670] mb-2">Students below this attendance rate will be flagged</p>
                <input 
                  type="number" 
                  value={settings.attendance_threshold}
                  onChange={(e) => handleSettingChange('attendance_threshold', parseInt(e.target.value) || 80)}
                  className="input w-32"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Grade Threshold (%)</label>
                <p className="text-sm text-[#5c6670] mb-2">Students scoring below this in 2+ subjects will be flagged</p>
                <input 
                  type="number" 
                  value={settings.grade_threshold}
                  onChange={(e) => handleSettingChange('grade_threshold', parseInt(e.target.value) || 50)}
                  className="input w-32"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Fee Threshold (UGX)</label>
                <p className="text-sm text-[#5c6670] mb-2">Students with payments below this amount will be flagged</p>
                <input 
                  type="number" 
                  value={settings.fee_threshold}
                  onChange={(e) => handleSettingChange('fee_threshold', parseInt(e.target.value) || 50000)}
                  className="input w-32"
                  min={0}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-[#191c1d] mb-6">Data Backup</h2>
            <div className="space-y-4">
              <div className="p-4 bg-[#f8fafb] rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[#191c1d]">Export All Data</div>
                    <div className="text-sm text-[#5c6670]">Download all school data as JSON</div>
                  </div>
                  <button onClick={exportAllData} className="btn btn-primary">
                    <MaterialIcon icon="download" className="text-lg" />
                    Export
                  </button>
                </div>
              </div>
              <div className="p-4 bg-[#f8fafb] rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[#191c1d]">Student Photos Backup</div>
                    <div className="text-sm text-[#5c6670]">Export student photos and documents</div>
                  </div>
                  <button className="btn btn-secondary">Export Photos</button>
                </div>
              </div>
              <div className="p-4 bg-[#fff8e6] rounded-xl border border-[#b86e00]/20">
                <div className="flex items-center gap-3">
                  <MaterialIcon icon="info" className="text-[#b86e00]" />
                  <div>
                    <div className="font-medium text-[#321b00]">Important</div>
                    <div className="text-sm text-[#5c6670]">Regular backups are recommended. Cloud backup is available on Premium plans.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddUser(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1d]">Add Staff Member</h2>
                <button onClick={() => setShowAddUser(false)} className="p-2 text-[#5c6670] hover:text-[#191c1d]">
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Full Name</label>
                <input type="text" value={newUser.full_name} onChange={(e) => setNewUser({...newUser, full_name: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Phone Number</label>
                <input type="tel" placeholder="0700000000" value={newUser.phone} onChange={(e) => setNewUser({...newUser, phone: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className="input">
                  <option value="teacher">Teacher</option>
                  <option value="school_admin">Administrator</option>
                  <option value="dos">Director of Studies</option>
                  <option value="bursar">Bursar</option>
                  <option value="secretary">Secretary</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Password</label>
                <input type="password" placeholder="Min 6 characters" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="input" required minLength={6} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddUser(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}