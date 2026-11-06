import React, { useState, useEffect } from 'react';
import { settingsApi } from '../../api/settings';
import { authApi } from '../../api/auth';
import { WatermarkPreview } from '../../components/WatermarkPreview';
import { 
  Settings as SettingsIcon, 
  Sparkles, 
  Building, 
  Truck, 
  Mail, 
  Lock, 
  Save, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('watermark');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Settings State
  const [watermark, setWatermark] = useState({
    enabled: false,
    type: 'text',
    text: 'Wedding Studio',
    image_key: '',
    position: 'bottom-right',
    opacity: 60,
    scale: 20,
    apply_to_client_preview: false,
  });

  const [branding, setBranding] = useState({
    studio_name: 'Wedding Studio',
    logo_key: '',
    phone: '',
    whatsapp: '',
    email: 'contact@weddingstudio.com',
    social_links: {
      instagram: '',
      facebook: '',
      youtube: '',
    },
  });

  const [delivery, setDelivery] = useState({
    link_valid_days: 7,
    max_downloads: 10,
    zip_part_mb: 1500,
    revoke_on_send: true,
  });

  const [emailSettings, setEmailSettings] = useState({
    from_name: 'Wedding Studio',
    from_address: 'notifications@weddingstudio.com',
    reply_to: 'contact@weddingstudio.com',
  });

  // Account Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      if (data.watermark) setWatermark(data.watermark);
      if (data.branding) setBranding(data.branding);
      if (data.delivery) setDelivery(data.delivery);
      if (data.email) setEmailSettings(data.email);
    } catch {
      setErrorMsg('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await settingsApi.update({
        watermark,
        branding,
        delivery,
        email: emailSettings,
      });
      setSuccessMsg('Settings saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleWatermarkImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await settingsApi.uploadWatermarkImage(file);
      setWatermark((prev) => ({ ...prev, image_key: res.image_key }));
      setSuccessMsg('Watermark image uploaded!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to upload watermark image.');
    }
  };

  const handleBrandingLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await settingsApi.uploadBrandingLogo(file);
      setBranding((prev) => ({ ...prev, logo_key: res.logo_key }));
      setSuccessMsg('Studio logo uploaded!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setErrorMsg('Failed to upload studio logo.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(''), 3500);
    } catch (err) {
      setPasswordError(err.response?.data?.old_password?.[0] || err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-stone-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-stone-500" />
        <p className="text-sm">Loading studio settings...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'watermark', label: 'Watermark', icon: Sparkles },
    { id: 'branding', label: 'Branding', icon: Building },
    { id: 'delivery', label: 'Delivery Rules', icon: Truck },
    { id: 'email', label: 'Email Configuration', icon: Mail },
    { id: 'account', label: 'Account Security', icon: Lock },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-stone-900">Platform Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Configure showcase watermarks, studio branding, delivery limits, and email notifications.
        </p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 bg-stone-200/60 p-1 rounded-xl overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Form */}
      {activeTab !== 'account' ? (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* WATERMARK SETTINGS */}
          {activeTab === 'watermark' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                  <div>
                    <h3 className="font-semibold text-stone-900 text-sm">Watermark Protection</h3>
                    <p className="text-xs text-stone-400">Burned into public showcase portfolio photos</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={watermark.enabled}
                      onChange={(e) => setWatermark({ ...watermark, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                    Watermark Type
                  </label>
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="wm_type"
                        value="text"
                        checked={watermark.type === 'text'}
                        onChange={() => setWatermark({ ...watermark, type: 'text' })}
                        className="text-amber-600"
                      />
                      <span>Text Brand</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="wm_type"
                        value="image"
                        checked={watermark.type === 'image'}
                        onChange={() => setWatermark({ ...watermark, type: 'image' })}
                        className="text-amber-600"
                      />
                      <span>Logo PNG / Image</span>
                    </label>
                  </div>
                </div>

                {watermark.type === 'text' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                      Watermark Text
                    </label>
                    <input
                      type="text"
                      value={watermark.text}
                      onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                      Upload Logo Image (PNG / WebP)
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/webp,image/svg+xml"
                      onChange={handleWatermarkImageUpload}
                      className="w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer"
                    />
                    {watermark.image_key && (
                      <p className="text-[11px] text-emerald-600 font-mono mt-1">Uploaded: {watermark.image_key}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Placement Position
                  </label>
                  <select
                    value={watermark.position}
                    onChange={(e) => setWatermark({ ...watermark, position: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="bottom-right">Bottom Right (Recommended)</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="center">Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="top-left">Top Left</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                      Opacity: {watermark.opacity}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={watermark.opacity}
                      onChange={(e) => setWatermark({ ...watermark, opacity: parseInt(e.target.value, 10) })}
                      className="w-full accent-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                      Scale / Size: {watermark.scale}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={watermark.scale}
                      onChange={(e) => setWatermark({ ...watermark, scale: parseInt(e.target.value, 10) })}
                      className="w-full accent-amber-600"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={watermark.apply_to_client_preview}
                      onChange={(e) => setWatermark({ ...watermark, apply_to_client_preview: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500"
                    />
                    <span className="text-xs text-stone-700">
                      Apply watermark to client preview images as well (default: off)
                    </span>
                  </label>
                </div>
              </div>

              {/* Live Preview Column */}
              <div className="lg:col-span-6 flex flex-col justify-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2 block">
                  Interactive Preview
                </span>
                <WatermarkPreview settings={watermark} />
                <p className="text-[11px] text-stone-400 mt-2">
                  * Note: Saving changes here will automatically trigger background regeneration of all public showcase photos (3 per published client).
                </p>
              </div>
            </div>
          )}

          {/* BRANDING SETTINGS */}
          {activeTab === 'branding' && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-5">
              <h3 className="font-semibold text-stone-900 text-sm pb-2 border-b border-stone-100">Studio Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Studio Name
                  </label>
                  <input
                    type="text"
                    value={branding.studio_name}
                    onChange={(e) => setBranding({ ...branding, studio_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Studio Logo Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBrandingLogoUpload}
                    className="w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={branding.phone}
                    onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={branding.whatsapp}
                    onChange={(e) => setBranding({ ...branding, whatsapp: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Public Email
                  </label>
                  <input
                    type="email"
                    value={branding.email}
                    onChange={(e) => setBranding({ ...branding, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              <h4 className="font-semibold text-stone-800 text-xs pt-4 uppercase tracking-wider">Social Links</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Instagram URL</label>
                  <input
                    type="url"
                    value={branding.social_links?.instagram || ''}
                    onChange={(e) => setBranding({
                      ...branding,
                      social_links: { ...branding.social_links, instagram: e.target.value },
                    })}
                    placeholder="https://instagram.com/yourhandle"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Facebook URL</label>
                  <input
                    type="url"
                    value={branding.social_links?.facebook || ''}
                    onChange={(e) => setBranding({
                      ...branding,
                      social_links: { ...branding.social_links, facebook: e.target.value },
                    })}
                    placeholder="https://facebook.com/yourpage"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">YouTube / Portfolio URL</label>
                  <input
                    type="url"
                    value={branding.social_links?.youtube || ''}
                    onChange={(e) => setBranding({
                      ...branding,
                      social_links: { ...branding.social_links, youtube: e.target.value },
                    })}
                    placeholder="https://youtube.com/@channel"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* DELIVERY SETTINGS */}
          {activeTab === 'delivery' && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-5">
              <h3 className="font-semibold text-stone-900 text-sm pb-2 border-b border-stone-100">
                Client Delivery & Download Rules
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Link Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={delivery.link_valid_days}
                    onChange={(e) => setDelivery({ ...delivery, link_valid_days: parseInt(e.target.value, 10) || 7 })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">Default: 7 days</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Max Downloads (Per Part)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={delivery.max_downloads}
                    onChange={(e) => setDelivery({ ...delivery, max_downloads: parseInt(e.target.value, 10) || 10 })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">Allows retrying broken downloads</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    ZIP Part Chunk Size (MB)
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="5000"
                    step="100"
                    value={delivery.zip_part_mb}
                    onChange={(e) => setDelivery({ ...delivery, zip_part_mb: parseInt(e.target.value, 10) || 1500 })}
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <span className="text-[11px] text-stone-400 mt-1 block">Default: 1500 MB (~1.5 GB)</span>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={delivery.revoke_on_send}
                    onChange={(e) => setDelivery({ ...delivery, revoke_on_send: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500"
                  />
                  <span className="text-xs text-stone-700 font-medium">
                    Automatically revoke older download links when admin sends a new link
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* EMAIL SETTINGS */}
          {activeTab === 'email' && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-5">
              <h3 className="font-semibold text-stone-900 text-sm pb-2 border-b border-stone-100">
                Email Dispatch Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={emailSettings.from_name}
                    onChange={(e) => setEmailSettings({ ...emailSettings, from_name: e.target.value })}
                    placeholder="Wedding Studio"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    From Address
                  </label>
                  <input
                    type="email"
                    value={emailSettings.from_address}
                    onChange={(e) => setEmailSettings({ ...emailSettings, from_address: e.target.value })}
                    placeholder="notifications@weddingstudio.com"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                    Reply-To Address
                  </label>
                  <input
                    type="email"
                    value={emailSettings.reply_to}
                    onChange={(e) => setEmailSettings({ ...emailSettings, reply_to: e.target.value })}
                    placeholder="contact@weddingstudio.com"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button for active settings tab */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-stone-100 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* ACCOUNT SECURITY TAB */
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm max-w-xl space-y-5">
          <h3 className="font-semibold text-stone-900 text-sm pb-2 border-b border-stone-100">
            Change Administrator Password
          </h3>

          {passwordMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{passwordMsg}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Current Password *
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                New Password (minimum 8 characters) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-stone-100 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{passwordSaving ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
