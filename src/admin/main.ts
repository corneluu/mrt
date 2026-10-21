import { supabase } from './supabase';
import { h, toast, errorText } from './ui';
import { renderCrud } from './crud';
import * as content from './content';
import { renderMesaje, renderFormulare, renderSetari, renderCos, renderJurnal, renderAdmini } from './screens';

const app = document.getElementById('admin-app')!;
let myEmail = '';

const SECTIONS: { id: string; label: string; icon: string; render: (root: HTMLElement) => unknown }[] = [
  { id: 'mesaje', label: 'Mesaje', icon: '✉️', render: renderMesaje },
  { id: 'proiecte', label: 'Proiecte', icon: '📁', render: (r) => renderCrud(r, content.proiecte) },
  { id: 'noutati', label: 'Noutăți', icon: '📰', render: (r) => renderCrud(r, content.noutati) },
  { id: 'galerie', label: 'Galerie', icon: '🖼️', render: (r) => renderCrud(r, content.galerie) },
  { id: 'echipa', label: 'Echipa', icon: '👥', render: (r) => renderCrud(r, content.echipa) },
  { id: 'voluntari', label: 'Voluntari', icon: '🤝', render: (r) => renderCrud(r, content.voluntari) },
  { id: 'parteneri', label: 'Parteneri', icon: '🏛️', render: (r) => renderCrud(r, content.parteneri) },
  { id: 'formulare', label: 'Formulare', icon: '📝', render: (r) => renderFormulare(r) },
  { id: 'setari', label: 'Setări site', icon: '⚙️', render: renderSetari },
  { id: 'cos', label: 'Coș', icon: '🗑️', render: renderCos },
  { id: 'jurnal', label: 'Jurnal', icon: '🕒', render: renderJurnal },
  { id: 'admini', label: 'Administratori', icon: '🔑', render: (r) => renderAdmini(r, myEmail) },
];

function renderLogin(message = '') {
  const email = h('input', { type: 'email', id: 'email', class: 'input', autocomplete: 'username', required: true });
  const password = h('input', { type: 'password', id: 'password', class: 'input', autocomplete: 'current-password', required: true });
  const btn = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Intră în cont');
  const msg = h('p', { class: 'error', role: 'alert' }, message);
  app.replaceChildren(h('main', { class: 'login' },
    h('form', {
      class: 'card login-card',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        btn.disabled = true; msg.textContent = '';
        const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        btn.disabled = false;
        // Same message for unknown email and wrong password, so the form doesn't reveal which accounts exist.
        if (error) msg.textContent = /invalid/i.test(error.message) ? 'Email sau parolă greșită.' : errorText(error);
      },
    },
      h('h1', {}, 'Administrare MRT'),
      h('div', { class: 'field' }, h('label', { for: 'email' }, 'Email'), email),
      h('div', { class: 'field' }, h('label', { for: 'password' }, 'Parolă'), password),
      msg,
      btn,
    ),
  ));
  email.focus();
}

function renderShell() {
  const content = h('main', { class: 'content', id: 'content', tabindex: -1 });
  const nav = h('nav', { class: 'sidebar', 'aria-label': 'Secțiuni' },
    h('div', { class: 'brand' }, 'MRT Admin'),
    h('ul', {}, ...SECTIONS.map((s) => h('li', {}, h('a', { href: `#${s.id}`, 'data-id': s.id }, h('span', { 'aria-hidden': 'true' }, s.icon), ' ', s.label)))),
    h('div', { class: 'sidebar-foot' },
      h('span', { class: 'muted' }, myEmail),
      h('button', { class: 'btn btn-sm', onclick: () => supabase.auth.signOut() }, 'Ieșire'),
    ),
  );
  const menuBtn = h('button', {
    class: 'menu-btn', 'aria-label': 'Meniu', 'aria-expanded': 'false',
    onclick: () => { const open = document.body.classList.toggle('nav-open'); menuBtn.setAttribute('aria-expanded', String(open)); },
  }, '☰');
  app.replaceChildren(
    h('header', { class: 'topbar' }, menuBtn, h('strong', {}, 'MRT Admin')),
    h('div', { class: 'layout' }, nav, content),
  );

  const route = () => {
    const id = location.hash.slice(1) || 'mesaje';
    const section = SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];
    nav.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.id === section.id));
    document.body.classList.remove('nav-open');
    document.title = `${section.label} · MRT Admin`;
    section.render(content);
  };
  window.onhashchange = route;
  route();
}

async function start(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
  if (!session) return renderLogin();
  // An account alone is not enough: it must be on the admin list.
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || !isAdmin) {
    await supabase.auth.signOut();
    return renderLogin(error ? errorText(error) : 'Contul nu are acces de administrator.');
  }
  myEmail = session.user.email ?? '';
  renderShell();
}

let current: string | null | undefined;
supabase.auth.onAuthStateChange((_event, session) => {
  // Token refreshes fire this too; only re-render when the user actually changes.
  const id = session?.user.id ?? null;
  if (id === current) return;
  current = id;
  start(session).catch((err) => toast(errorText(err), 'error'));
});
