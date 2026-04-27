import os
import re

path = r"c:\Users\esth633\Desktop\hk\wwwroot\js\app.js"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add generic modal helpers if not present
modal_helpers = """
// ========================================
// Modal Helpers
// ========================================
App.prototype.showModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        // If it's a modal-overlay, we might want to ensure it uses flex
        if (modal.classList.contains('modal-overlay') || modal.classList.contains('modal')) {
             modal.style.display = 'flex';
        }
    }
};

App.prototype.hideModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
};
"""

if "App.prototype.showModal" not in content:
    # Append after init method or at the end
    content += "\n\n" + modal_helpers

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modal helpers added to app.js")
