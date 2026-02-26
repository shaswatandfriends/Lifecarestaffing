const loginCard = document.getElementById('loginCard');
const editorCard = document.getElementById('editorCard');
const editorForm = document.getElementById('editorForm');
const loginMsg = document.getElementById('loginMsg');
const saveMsg = document.getElementById('saveMsg');

let token = localStorage.getItem('adminToken') || '';
let content = null;

const flatten = (obj, prefix = '') => Object.entries(obj).reduce((acc, [k, v]) => {
  const key = prefix ? `${prefix}.${k}` : k;
  if (Array.isArray(v)) {
    v.forEach((item, idx) => {
      if (typeof item === 'object' && item) Object.assign(acc, flatten(item, `${key}.${idx}`));
      else acc[`${key}.${idx}`] = item;
    });
  } else if (typeof v === 'object' && v) {
    Object.assign(acc, flatten(v, key));
  } else {
    acc[key] = v;
  }
  return acc;
}, {});

const unflatten = (flat) => {
  const result = {};
  Object.entries(flat).forEach(([path, value]) => {
    const parts = path.split('.');
    let cur = result;
    parts.forEach((p, i) => {
      const isLast = i === parts.length - 1;
      const nextIsIndex = !isLast && /^\d+$/.test(parts[i + 1]);
      const isIndex = /^\d+$/.test(p);
      const key = isIndex ? Number(p) : p;

      if (isLast) {
        cur[key] = value;
      } else {
        if (cur[key] == null) cur[key] = nextIsIndex ? [] : {};
        cur = cur[key];
      }
    });
  });
  return result;
};

const parseInput = (v) => {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
};

const isImageField = (key) => /(image|photo)$/i.test(key) || /\.(image|photo)$/i.test(key);

const renderForm = () => {
  const flat = flatten(content);
  editorForm.innerHTML = Object.entries(flat).map(([k, v]) => {
    const safeValue = String(v ?? '').replace(/"/g, '&quot;');
    const uploader = isImageField(k)
      ? `<label class="upload-label">Upload from device <input type="file" accept="image/*" data-target="${k}" class="image-upload" /></label><small class="muted">Tip: paste LinkedIn image URL or upload from your device.</small>`
      : '';
    return `
      <label>
        <span>${k}</span>
        <input name="${k}" value="${safeValue}" />
        ${uploader}
      </label>
    `;
  }).join('');

  [...document.querySelectorAll('.image-upload')].forEach((input) => {
    input.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const target = event.target.dataset.target;
      const field = editorForm.querySelector(`input[name="${CSS.escape(target)}"]`);
      if (!field) return;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      field.value = dataUrl;
      saveMsg.textContent = `Image loaded for ${target}. Click Save Changes.`;
    });
  });
};

const loadContent = async () => {
  const res = await fetch('/api/content');
  content = await res.json();
  renderForm();
};

document.getElementById('loginBtn').onclick = async () => {
  const password = document.getElementById('password').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    loginMsg.textContent = 'Invalid password';
    return;
  }
  const data = await res.json();
  token = data.token;
  localStorage.setItem('adminToken', token);
  loginMsg.textContent = 'Login successful.';
  loginCard.classList.add('hidden');
  editorCard.classList.remove('hidden');
  loadContent();
};

document.getElementById('saveBtn').onclick = async () => {
  const formData = new FormData(editorForm);
  const flat = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, parseInput(v)]));
  const payload = unflatten(flat);
  const res = await fetch('/api/admin/content', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  saveMsg.textContent = res.ok ? 'Saved successfully.' : 'Save failed. Please login again.';
};

if (token) {
  loginCard.classList.add('hidden');
  editorCard.classList.remove('hidden');
  loadContent();
}
