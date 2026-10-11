/* 放課後ゲーム部 / 共通UI補助
 * ナビと既存の確認画面にアクセシビリティ情報だけを補う。
 * ゲームのイベントリスナー、HTML構造、ボタン文言、遷移、タイマー、保存データは変更しない。
 */
(() => {
  'use strict';
  const dialogSelectors = [
    '.modal-backdrop > .modal',
    '.modal-backdrop > section.modal',
    '.recheck-backdrop > .recheck-modal',
    '.quit-backdrop > .quit-card',
    '.pause-backdrop > .pause-card',
    '.leave-confirm > .leave-confirm-card',
    '.nav-confirm-backdrop .modal'
  ].join(',');
  let nextTitleId = 0;

  function enhanceNav(nav) {
    if (!nav.hasAttribute('aria-label')) nav.setAttribute('aria-label', 'ゲームナビゲーション');
    if (nav.tagName !== 'NAV' && !nav.hasAttribute('role')) nav.setAttribute('role', 'navigation');
    const buttons = Array.from(nav.children).filter(node =>
      node.tagName === 'BUTTON' && !node.hasAttribute('data-hg-settings-open'));
    // 各ゲーム固有の戻る処理はそのまま。誤解を生む「1個前」だけ表示から外す。
    if (buttons[0] && /^\\s*←\\s*1個前にもどる\\s*$/.test(buttons[0].textContent)) {
      buttons[0].textContent = '← もどる';
    }
    if (buttons[0] && !buttons[0].hasAttribute('aria-label')) {
      buttons[0].setAttribute('aria-label', 'もどる');
    }
    if (buttons[1] && !buttons[1].hasAttribute('aria-label')) {
      buttons[1].setAttribute('aria-label', 'ゲーム一覧に戻る');
    }
  }

  function enhanceDialog(dialog) {
    if (dialog.hasAttribute('data-hg-ui-dialog')) return;
    dialog.setAttribute('data-hg-ui-dialog', '');
    if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
    if (!dialog.hasAttribute('aria-modal')) dialog.setAttribute('aria-modal', 'true');
    if (!dialog.hasAttribute('aria-labelledby')) {
      const title = dialog.querySelector('h1, h2');
      if (title) {
        if (!title.id) title.id = 'hg-ui-dialog-title-' + (++nextTitleId);
        dialog.setAttribute('aria-labelledby', title.id);
      }
    }
  }

  function enhance() {
    const app = document.getElementById('app');
    app?.querySelectorAll('.top-nav').forEach(enhanceNav);
    document.querySelectorAll(dialogSelectors).forEach(enhanceDialog);
  }

  function init() {
    document.body.classList.add('hg-common-ui');
    const app = document.getElementById('app');
    if (!app || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(enhance);
    // 画面の描画差し替え（#app直下）と確認画面の追加（body直下）のみ監視。
    // パズル盤面等の内部更新を監視しないため、プレイ処理に負荷をかけない。
    observer.observe(app, {childList:true});
    observer.observe(document.body, {childList:true});
    enhance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
