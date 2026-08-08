import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './DroxionProfile.css';

const emptyProfile = {
  display_name: '',
  username: '',
  bio: '',
  date_of_birth: '',
  country: 'United States',
  language: 'English',
  gender: '',
  interests: '',
  avatar_url: '',
  discovery_enabled: true,
  show_country: true,
  allow_messages: true,
  allow_video_calls: true
};

const panelStyle = {
  background: '#ffffff',
  color: '#111827',
  border: '1px solid #e7eaf0',
  borderRadius: 20,
  padding: 20,
  marginTop: 16,
  boxShadow: '0 8px 28px rgba(15, 23, 42, 0.06)'
};

const profilePageStyle = {
  color: '#111827',
  minHeight: '100%',
  paddingBottom: 110
};

const mutedTextStyle = {
  color: '#64748b'
};

const noticeStyle = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: '#eef2ff',
  color: '#3730a3',
  border: '1px solid #c7d2fe',
  fontWeight: 600
};

const menuButtonStyle = {
  width: '100%',
  border: '1px solid #e7eaf0',
  background: '#ffffff',
  color: '#111827',
  borderRadius: 16,
  padding: '16px 17px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  cursor: 'pointer',
  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)'
};

const inputStyle = {
  width: '100%',
  border: '1px solid #d7dce3',
  borderRadius: 12,
  padding: '12px 13px',
  font: 'inherit',
  background: '#ffffff',
  color: '#111827',
  boxSizing: 'border-box',
  outline: 'none'
};

const labelStyle = {
  display: 'block',
  color: '#374151',
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 7
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 12
};

function isAtLeast21(value) {
  if (!value) return true;

  const dob = new Date(`${value}T00:00:00`);
  const cutoff = new Date();

  cutoff.setFullYear(
    cutoff.getFullYear() - 21
  );

  return dob <= cutoff;
}

function initials(name) {
  return (name || 'D')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

export default function DroxionProfile({
  onOpenWallet,
  coins = 0,
  freeMatches = 0,
  plan = 'free'
}) {
  const [view, setView] = useState('main');
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');

  const [profile, setProfile] =
    useState(emptyProfile);

  const [connections, setConnections] =
    useState(0);

  const [following, setFollowing] =
    useState(0);

  const [creator, setCreator] =
    useState(null);

  const [creatorEarnings, setCreatorEarnings] =
    useState(0);

  const [blocks, setBlocks] =
    useState([]);

  const [tickets, setTickets] =
    useState([]);

  const [notice, setNotice] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [safetyForm, setSafetyForm] =
    useState({
      category: 'Safety concern',
      details: ''
    });

  const [supportForm, setSupportForm] =
    useState({
      category: 'Account',
      subject: '',
      message: ''
    });


  useEffect(() => {
    initializeProfile();
  }, []);


  async function initializeProfile() {
    setLoading(true);
    setNotice('');

    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      setNotice(
        'Your session expired. Please sign in again.'
      );

      setLoading(false);
      return;
    }

    setUserId(user.id);
    setEmail(user.email || '');

    await Promise.all([
      loadProfile(user.id),
      loadStats(user.id),
      loadCreator(user.id),
      loadBlocks(user.id),
      loadTickets(user.id)
    ]);

    setLoading(false);
  }


  async function loadProfile(uid) {
    const { data, error } = await supabase
      .from('droxion_profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      setNotice(error.message);
      return;
    }

    if (!data) return;

    setProfile({
      display_name:
        data.display_name || '',
      username:
        data.username || '',
      bio:
        data.bio || '',
      date_of_birth:
        data.date_of_birth || '',
      country:
        data.country || 'United States',
      language:
        data.language || 'English',
      gender:
        data.gender || '',
      interests:
        Array.isArray(data.interests)
          ? data.interests.join(', ')
          : '',
      avatar_url:
        data.avatar_url || '',
      discovery_enabled:
        data.discovery_enabled !== false,
      show_country:
        data.show_country !== false,
      allow_messages:
        data.allow_messages !== false,
      allow_video_calls:
        data.allow_video_calls !== false
    });
  }


  async function loadStats(uid) {
    const [
      followsResult,
      connectionsResult
    ] = await Promise.all([
      supabase
        .from('droxion_follows')
        .select('followed_id')
        .eq('follower_id', uid),

      supabase
        .from('droxion_connections')
        .select('id')
        .eq('status', 'accepted')
        .or(
          `requester_id.eq.${uid},receiver_id.eq.${uid}`
        )
    ]);

    setFollowing(
      followsResult.data?.length || 0
    );

    setConnections(
      connectionsResult.data?.length || 0
    );
  }


  async function loadCreator(uid) {
    const [
      accountResult,
      earningsResult
    ] = await Promise.all([
      supabase
        .from('droxion_creator_accounts')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle(),

      supabase
        .from('droxion_creator_earnings')
        .select('amount_cents')
        .eq('user_id', uid)
    ]);

    setCreator(
      accountResult.data || null
    );

    const total = (
      earningsResult.data || []
    ).reduce(
      (sum, row) =>
        sum + Number(row.amount_cents || 0),
      0
    );

    setCreatorEarnings(total);
  }


  async function loadBlocks(uid) {
    const { data } = await supabase
      .from('droxion_blocks')
      .select(
        'blocked_user_id, created_at'
      )
      .eq('blocker_id', uid)
      .order('created_at', {
        ascending: false
      });

    setBlocks(data || []);
  }


  async function loadTickets(uid) {
    const { data } = await supabase
      .from('droxion_support_tickets')
      .select(
        'id, category, subject, status, created_at'
      )
      .eq('user_id', uid)
      .order('created_at', {
        ascending: false
      });

    setTickets(data || []);
  }


  function updateProfile(key, value) {
    setProfile(current => ({
      ...current,
      [key]: value
    }));
  }


  async function saveProfile() {
    if (!userId) return;

    setNotice('');

    const displayName =
      profile.display_name.trim();

    const username =
      profile.username
        .trim()
        .toLowerCase();

    if (!displayName) {
      setNotice(
        'Display name is required.'
      );
      return;
    }

    if (
      username &&
      !/^[a-z0-9_]{3,24}$/.test(username)
    ) {
      setNotice(
        'Username must be 3-24 characters using letters, numbers or underscores.'
      );
      return;
    }

    if (
      profile.date_of_birth &&
      !isAtLeast21(profile.date_of_birth)
    ) {
      setNotice(
        'Droxion is only available to users age 21 or older.'
      );
      return;
    }

    setSaving(true);

    const interests =
      profile.interests
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 12);

    const { error } = await supabase
      .from('droxion_profiles')
      .update({
        display_name: displayName,
        username:
          username || null,
        bio:
          profile.bio.trim() || null,
        date_of_birth:
          profile.date_of_birth || null,
        country:
          profile.country.trim() || null,
        language:
          profile.language.trim() || null,
        gender:
          profile.gender || null,
        interests
      })
      .eq('user_id', userId);

    if (error) {
      setNotice(error.message);
      setSaving(false);
      return;
    }

    await supabase.auth.updateUser({
      data: {
        full_name: displayName,
        avatar_url:
          profile.avatar_url || null
      }
    });

    setNotice(
      'Profile saved successfully.'
    );

    setSaving(false);
  }


  async function uploadAvatar(event) {
    const file =
      event.target.files?.[0];

    event.target.value = '';

    if (!file || !userId) return;

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowed.includes(file.type)) {
      setNotice(
        'Use a JPG, PNG or WebP image.'
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice(
        'Profile photo must be 5 MB or smaller.'
      );
      return;
    }

    setUploading(true);
    setNotice(
      'Uploading profile photo...'
    );

    const extension =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';

    const path =
      `${userId}/${Date.now()}.${extension}`;

    const { error } = await supabase
      .storage
      .from('droxion-avatars')
      .upload(
        path,
        file,
        {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        }
      );

    if (error) {
      setNotice(error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase
      .storage
      .from('droxion-avatars')
      .getPublicUrl(path);

    const avatarUrl =
      data?.publicUrl || '';

    const { error: profileError } =
      await supabase
        .from('droxion_profiles')
        .update({
          avatar_url: avatarUrl
        })
        .eq('user_id', userId);

    if (profileError) {
      setNotice(
        profileError.message
      );

      setUploading(false);
      return;
    }

    await supabase.auth.updateUser({
      data: {
        avatar_url: avatarUrl
      }
    });

    setProfile(current => ({
      ...current,
      avatar_url: avatarUrl
    }));

    setNotice(
      'Profile photo updated.'
    );

    setUploading(false);
  }


  async function savePrivacy() {
    if (!userId) return;

    setSaving(true);
    setNotice('');

    const { error } = await supabase
      .from('droxion_profiles')
      .update({
        discovery_enabled:
          profile.discovery_enabled,
        show_country:
          profile.show_country,
        allow_messages:
          profile.allow_messages,
        allow_video_calls:
          profile.allow_video_calls
      })
      .eq('user_id', userId);

    if (error) {
      setNotice(error.message);
    } else {
      setNotice(
        'Privacy settings saved.'
      );
    }

    setSaving(false);
  }


  async function applyCreator() {
    if (!userId) return;

    setNotice('');

    if (creator) {
      setNotice(
        `Creator application status: ${creator.status}.`
      );
      return;
    }

    const { error } = await supabase
      .from(
        'droxion_creator_accounts'
      )
      .insert({
        user_id: userId,
        creator_name:
          profile.display_name ||
          profile.username ||
          'Droxion Creator',
        creator_bio:
          profile.bio || null
      });

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadCreator(userId);

    setNotice(
      'Creator application submitted.'
    );
  }


  async function unblockUser(blockedId) {
    const { error } = await supabase
      .from('droxion_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq(
        'blocked_user_id',
        blockedId
      );

    if (error) {
      setNotice(error.message);
      return;
    }

    await loadBlocks(userId);

    setNotice(
      'User unblocked.'
    );
  }


  async function submitSafetyReport() {
    if (
      !safetyForm.details.trim()
    ) {
      setNotice(
        'Tell us what happened first.'
      );
      return;
    }

    const { error } = await supabase
      .from('droxion_reports')
      .insert({
        reporter_id: userId,
        reported_user_id: null,
        category:
          safetyForm.category,
        details:
          safetyForm.details.trim()
      });

    if (error) {
      setNotice(error.message);
      return;
    }

    setSafetyForm({
      category: 'Safety concern',
      details: ''
    });

    setNotice(
      'Safety report submitted.'
    );
  }


  async function submitSupportTicket() {
    if (
      !supportForm.subject.trim() ||
      !supportForm.message.trim()
    ) {
      setNotice(
        'Subject and message are required.'
      );
      return;
    }

    const { error } = await supabase
      .from(
        'droxion_support_tickets'
      )
      .insert({
        user_id: userId,
        category:
          supportForm.category,
        subject:
          supportForm.subject.trim(),
        message:
          supportForm.message.trim()
      });

    if (error) {
      setNotice(error.message);
      return;
    }

    setSupportForm({
      category: 'Account',
      subject: '',
      message: ''
    });

    await loadTickets(userId);

    setNotice(
      'Support ticket submitted.'
    );
  }


  async function logout() {
    const { error } =
      await supabase.auth.signOut({
        scope: 'local'
      });

    if (error) {
      setNotice(error.message);
      return;
    }

    window.location.assign('/login');
  }


  function BackHeader({
    title,
    description
  }) {
    return (
      <div className="sectionHead">
        <div>
          <button
            type="button"
            onClick={() => {
              setView('main');
              setNotice('');
            }}
            style={{
              border: 0,
              background: 'transparent',
              fontWeight: 800,
              cursor: 'pointer',
              padding: 0,
              marginBottom: 10,
              color: '#4f46e5'
            }}
          >
            ← Profile
          </button>

          <h1>{title}</h1>

          {description && (
            <p>{description}</p>
          )}
        </div>
      </div>
    );
  }


  if (loading) {
    return (
      <div className="pagePad droxionProfilePage" style={profilePageStyle}>
        <h2>Profile</h2>
        <p>Loading your account...</p>
      </div>
    );
  }


  if (view === 'edit') {
    return (
      <div className="pagePad droxionProfilePage" style={profilePageStyle}>
        <BackHeader
          title="Edit Profile"
          description="Your Droxion identity and discovery information."
        />

        <div className="profilePanel" style={panelStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 20
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div className="avatar">
                {initials(
                  profile.display_name
                )}
              </div>
            )}

            <label
              style={{
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              📷 {
                uploading
                  ? 'Uploading...'
                  : 'Change photo'
              }

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadAvatar}
                disabled={uploading}
                style={{
                  display: 'none'
                }}
              />
            </label>
          </div>

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>
                Display name
              </label>

              <input
                style={inputStyle}
                value={
                  profile.display_name
                }
                onChange={event =>
                  updateProfile(
                    'display_name',
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Username
              </label>

              <input
                style={inputStyle}
                placeholder="dhruv"
                value={profile.username}
                onChange={event =>
                  updateProfile(
                    'username',
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Date of birth
              </label>

              <input
                type="date"
                style={inputStyle}
                value={
                  profile.date_of_birth
                }
                onChange={event =>
                  updateProfile(
                    'date_of_birth',
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Gender
              </label>

              <select
                style={inputStyle}
                value={profile.gender}
                onChange={event =>
                  updateProfile(
                    'gender',
                    event.target.value
                  )
                }
              >
                <option value="">
                  Select
                </option>
                <option value="Man">
                  Man
                </option>
                <option value="Woman">
                  Woman
                </option>
                <option value="Non-binary">
                  Non-binary
                </option>
                <option value="Prefer not to say">
                  Prefer not to say
                </option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Country
              </label>

              <input
                style={inputStyle}
                value={profile.country}
                onChange={event =>
                  updateProfile(
                    'country',
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label style={labelStyle}>
                Language
              </label>

              <input
                style={inputStyle}
                value={profile.language}
                onChange={event =>
                  updateProfile(
                    'language',
                    event.target.value
                  )
                }
              />
            </div>
          </div>

          <div style={{marginTop:12}}>
            <label style={labelStyle}>
              Interests
            </label>

            <input
              style={inputStyle}
              placeholder="Travel, gaming, music"
              value={profile.interests}
              onChange={event =>
                updateProfile(
                  'interests',
                  event.target.value
                )
              }
            />
          </div>

          <div style={{marginTop:12}}>
            <label style={labelStyle}>
              Bio
            </label>

            <textarea
              style={{
                ...inputStyle,
                minHeight: 110,
                resize: 'vertical'
              }}
              maxLength={500}
              value={profile.bio}
              onChange={event =>
                updateProfile(
                  'bio',
                  event.target.value
                )
              }
            />
          </div>

          <button
            className="bigCTA"
            style={{marginTop:16}}
            disabled={saving}
            onClick={saveProfile}
          >
            {
              saving
                ? 'Saving...'
                : 'Save Profile'
            }
          </button>
        </div>

        {notice && (
          <div style={noticeStyle}>
            {notice}
          </div>
        )}
      </div>
    );
  }


  if (view === 'creator') {
    return (
      <div className="pagePad droxionProfilePage" style={profilePageStyle}>
        <BackHeader
          title="Creator Dashboard"
          description="Creator applications and earnings."
        />

        <div className="profilePanel" style={panelStyle}>
          <h3>Creator status</h3>

          <p>
            {
              creator
                ? creator.status.toUpperCase()
                : 'NOT APPLIED'
            }
          </p>

          <h2 style={{marginTop:20}}>
            ${(creatorEarnings / 100).toFixed(2)}
          </h2>

          <p>
            Lifetime recorded creator earnings
          </p>

          {!creator && (
            <button
              className="bigCTA"
              style={{marginTop:18}}
              onClick={applyCreator}
            >
              Apply to Become a Creator
            </button>
          )}
        </div>

        {notice && (
          <div style={noticeStyle}>
            {notice}
          </div>
        )}
      </div>
    );
  }


  if (view === 'safety') {
    return (
      <div className="pagePad droxionProfilePage" style={profilePageStyle}>
        <BackHeader
          title="Safety Center"
          description="Manage blocked users and report safety concerns."
        />

        <div className="profilePanel" style={panelStyle}>
          <h3>Blocked users</h3>

          {blocks.length === 0 ? (
            <p>No blocked users.</p>
          ) : (
            blocks.map(item => (
              <div
                key={
                  item.blocked_user_id
                }
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom:
                    '1px solid #eee'
                }}
              >
                <span>
                  User {
                    item.blocked_user_id
                      .slice(0, 8)
                  }…
                </span>

                <button
                  type="button"
                  onClick={() =>
                    unblockUser(
                      item.blocked_user_id
                    )
                  }
                >
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>

        <div className="profilePanel" style={panelStyle}>
          <h3>Report a concern</h3>

          <select
            style={{
              ...inputStyle,
              marginTop: 12
            }}
            value={
              safetyForm.category
            }
            onChange={event =>
              setSafetyForm(current => ({
                ...current,
                category:
                  event.target.value
              }))
            }
          >
            <option>
              Safety concern
            </option>
            <option>
              Harassment
            </option>
            <option>
              Scam or fraud
            </option>
            <option>
              Underage concern
            </option>
            <option>
              Inappropriate content
            </option>
            <option>
              Other
            </option>
          </select>

          <textarea
            style={{
              ...inputStyle,
              minHeight: 120,
              marginTop: 12
            }}
            placeholder="Tell us what happened..."
            value={
              safetyForm.details
            }
            onChange={event =>
              setSafetyForm(current => ({
                ...current,
                details:
                  event.target.value
              }))
            }
          />

          <button
            className="bigCTA"
            style={{marginTop:12}}
            onClick={submitSafetyReport}
          >
            Submit Safety Report
          </button>
        </div>

        {notice && (
          <div style={noticeStyle}>
            {notice}
          </div>
        )}
      </div>
    );
  }


  if (view === 'privacy') {
    const toggles = [
      [
        'discovery_enabled',
        'Show me in Discover',
        'Allow your profile to appear in discovery.'
      ],
      [
        'show_country',
        'Show my country',
        'Display your country to other users.'
      ],
      [
        'allow_messages',
        'Allow messages',
        'Allow eligible users to message you.'
      ],
      [
        'allow_video_calls',
        'Allow video calls',
        'Allow eligible users to start video calls.'
      ]
    ];

    return (
      <div className="pagePad droxionProfilePage" style={profilePageStyle}>
        <BackHeader
          title="Privacy"
          description="Control how people can find and contact you."
        />

        <div className="profilePanel" style={panelStyle}>
          {toggles.map(
            ([key, title, text]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '14px 0',
                  borderBottom:
                    '1px solid #eee',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      profile[key]
                    )
                  }
                  onChange={event =>
                    updateProfile(
                      key,
                      event.target.checked
                    )
                  }
                />

                <div>
                  <strong>{title}</strong>
                  <div
                    style={{
                      fontSize: 13,
                      opacity: .7,
                      marginTop: 3
                    }}
                  >
                    {text}
                  </div>
                </div>
              </label>
            )
          )}

          <button
            className="bigCTA"
            style={{marginTop:16}}
            disabled={saving}
            onClick={savePrivacy}
          >
            Save Privacy Settings
          </button>
        </div>

        {notice && (
          <div style={noticeStyle}>
            {notice}
          </div>
        )}
      </div>
    );
  }


  if (view === 'support') {
    return (
      <div className="pagePad droxionProfilePage" style={profilePageStyle}>
        <BackHeader
          title="Help & Support"
          description="Send a real support request to Droxion."
        />

        <div className="profilePanel" style={panelStyle}>
          <select
            style={inputStyle}
            value={
              supportForm.category
            }
            onChange={event =>
              setSupportForm(current => ({
                ...current,
                category:
                  event.target.value
              }))
            }
          >
            <option>Account</option>
            <option>Payments</option>
            <option>Video calls</option>
            <option>Safety</option>
            <option>Creator</option>
            <option>Technical issue</option>
            <option>Other</option>
          </select>

          <input
            style={{
              ...inputStyle,
              marginTop: 12
            }}
            placeholder="Subject"
            value={
              supportForm.subject
            }
            onChange={event =>
              setSupportForm(current => ({
                ...current,
                subject:
                  event.target.value
              }))
            }
          />

          <textarea
            style={{
              ...inputStyle,
              minHeight: 120,
              marginTop: 12
            }}
            placeholder="How can we help?"
            value={
              supportForm.message
            }
            onChange={event =>
              setSupportForm(current => ({
                ...current,
                message:
                  event.target.value
              }))
            }
          />

          <button
            className="bigCTA"
            style={{marginTop:12}}
            onClick={submitSupportTicket}
          >
            Send Support Request
          </button>
        </div>

        <div className="profilePanel" style={panelStyle}>
          <h3>Your requests</h3>

          {tickets.length === 0 ? (
            <p>No support tickets yet.</p>
          ) : (
            tickets.map(ticket => (
              <div
                key={ticket.id}
                style={{
                  padding: '12px 0',
                  borderBottom:
                    '1px solid #eee'
                }}
              >
                <strong>
                  {ticket.subject}
                </strong>

                <div
                  style={{
                    fontSize: 13,
                    marginTop: 4
                  }}
                >
                  {ticket.category}
                  {' · '}
                  {ticket.status}
                  {' · '}
                  {
                    new Date(
                      ticket.created_at
                    ).toLocaleDateString()
                  }
                </div>
              </div>
            ))
          )}
        </div>

        {notice && (
          <div style={noticeStyle}>
            {notice}
          </div>
        )}
      </div>
    );
  }


  const menu = [
    {
      title: 'Edit Profile',
      subtitle:
        'Photo, name, bio, country and interests',
      action: () =>
        setView('edit')
    },
    {
      title: 'Wallet & Coins',
      subtitle:
        `${coins} coins · ${freeMatches} free matches`,
      action: () =>
        onOpenWallet?.()
    },
    {
      title: 'Droxion+',
      subtitle:
        `${plan.toUpperCase()} plan · View Plus & VIP`,
      action: () =>
        onOpenWallet?.()
    },
    {
      title: 'Creator Dashboard',
      subtitle:
        creator
          ? `Status: ${creator.status}`
          : 'Apply and track earnings',
      action: () =>
        setView('creator')
    },
    {
      title: 'Safety Center',
      subtitle:
        'Blocked users, reports and safety',
      action: () =>
        setView('safety')
    },
    {
      title: 'Privacy',
      subtitle:
        'Discovery, messages and video calls',
      action: () =>
        setView('privacy')
    },
    {
      title: 'Help & Support',
      subtitle:
        'Contact Droxion support',
      action: () =>
        setView('support')
    }
  ];


  return (
    <div className="pagePad droxionProfilePage" style={profilePageStyle}>

      <div className="profileHeader">

        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile"
            style={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: 12
            }}
          />
        ) : (
          <div className="avatar">
            {initials(
              profile.display_name
            )}
          </div>
        )}

        <h2>
          {
            profile.display_name ||
            profile.username ||
            'Droxion User'
          }
        </h2>

        <p style={mutedTextStyle}>
          {
            profile.country ||
            'Global'
          }
          {' · '}
          {
            profile.language ||
            'English'
          }
          {' · 21+'}
        </p>

        <div className="stats">
          <div>
            <strong>
              {connections}
            </strong>
            <span>
              Connections
            </span>
          </div>

          <div>
            <strong>
              {following}
            </strong>
            <span>
              Following
            </span>
          </div>

          <div>
            <strong>
              {plan.toUpperCase()}
            </strong>
            <span>
              Plan
            </span>
          </div>
        </div>
      </div>


      <div className="profilePanel" style={panelStyle}>
        <strong>
          {email}
        </strong>

        <div
          style={{
            marginTop: 5,
            fontSize: 13,
            opacity: .7
          }}
        >
          🪙 {coins} coins
          {' · '}
          {freeMatches} free matches
        </div>
      </div>


      <div className="settingsList">
        {menu.map(item => (
          <button
            key={item.title}
            type="button"
            onClick={item.action}
            style={menuButtonStyle}
          >
            <div
              style={{
                textAlign: 'left'
              }}
            >
              <strong>
                {item.title}
              </strong>

              <div
                style={{
                  fontSize: 12,
                  opacity: .65,
                  marginTop: 3
                }}
              >
                {item.subtitle}
              </div>
            </div>

            <span
              style={{
                color: '#94a3b8',
                fontSize: 24,
                lineHeight: 1
              }}
            >
              ›
            </span>
          </button>
        ))}


        <button
          type="button"
          onClick={logout}
          style={{
            ...menuButtonStyle,
            color: '#dc2626',
            borderColor: '#fecaca',
            background: '#fff7f7'
          }}
        >
          <strong>
            Log Out
          </strong>

          <span>›</span>
        </button>
      </div>


      {notice && (
        <div style={noticeStyle}>
          {notice}
        </div>
      )}
    </div>
  );
}
