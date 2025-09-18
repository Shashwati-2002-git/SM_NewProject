// header.js
(function () {
  function updateHeader() {
    const isLoggedIn = localStorage.getItem("loggedInUser") === "true";
    const loginLink = document.querySelector(".login-link");
    if (!loginLink) return;

    const menuDropdown = document.querySelector(".menu-dropdown");

    if (isLoggedIn) {
      // Show Logout
      loginLink.innerHTML = `<img src="images/Profile_Icon_Design.jpg" alt="Profile" class="profile-icon"> Logout`;
      loginLink.href = "#";

      // Attach logout handler
      loginLink.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem("loggedInUser");
        updateHeader(); // refresh header back to Login
      };
    } else {
      // Show Login
      loginLink.innerHTML = `<img src="images/Profile_Icon_Design.jpg" alt="Profile" class="profile-icon"> Login`;
      loginLink.href = "login.html";
      loginLink.onclick = null;
    }
  }

  // Expose for global use
  window.updateHeader = updateHeader;
})();