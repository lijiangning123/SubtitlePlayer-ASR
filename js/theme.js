window.DP = window.DP || {};

// ==================== Properties ====================
DP.currentTheme     = 'default';
DP.allThemeClasses  = ['theme-hacker', 'theme-moonlight', 'theme-sakura', 'theme-forest', 'theme-sunset'];

// ==================== setTheme ====================
DP.setTheme = function(themeName) {
  // 清除旧主题
  document.body.classList.remove(...DP.allThemeClasses);
  if (themeName !== 'default') {
    document.body.classList.add('theme-' + themeName);
  }
  DP.currentTheme = themeName;
  // 更新菜单选中态
  if (DP.themeMenu) {
    DP.themeMenu.querySelectorAll('.theme-menu-item').forEach(function(item) {
      item.classList.toggle('active', item.dataset.theme === themeName);
    });
  }
  try { localStorage.setItem('dp_theme', themeName); } catch(e) {}
};

// ==================== Event Handlers ====================
(function() {
  const btnTheme  = document.getElementById('btnTheme');
  const themeMenu = document.getElementById('themeMenu');

  DP.btnTheme   = btnTheme;
  DP.themeMenu  = themeMenu;

  // 点击按钮切换菜单
  btnTheme.addEventListener('click', function(e) {
    e.stopPropagation();
    themeMenu.classList.toggle('open');
  });

  // 点击菜单项选择主题
  themeMenu.addEventListener('click', function(e) {
    const item = e.target.closest('.theme-menu-item');
    if (!item) return;
    DP.setTheme(item.dataset.theme);
    themeMenu.classList.remove('open');
  });

  // 点击其他地方关闭菜单
  document.addEventListener('click', function() {
    themeMenu.classList.remove('open');
  });
})();
