console.log('🔥 CHARACTER-SELECTION.JS FILE IS LOADING!');

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎮 Character selection script loaded!');
  
  // Always show character selection directly (prologue is handled by /prologue route)
  const characterSelectionSection = document.querySelector('.character-selection');
  if (characterSelectionSection) {
    characterSelectionSection.style.display = 'block';
  }
  
  initializeCharacterSelection();
  
  function initializeCharacterSelection() {
    const avatarChoices = document.querySelectorAll('.avatar-choice');
    const selectedAvatarInput = document.getElementById('selectedAvatar');
    const selectedCharacterTypeInput = document.getElementById('selectedCharacterType');
    const profileCircle = document.getElementById('profileCircle');
    
    console.log('📋 Found elements:', {
      avatarChoices: avatarChoices.length,
      selectedAvatarInput: !!selectedAvatarInput,
      selectedCharacterTypeInput: !!selectedCharacterTypeInput,
      profileCircle: !!profileCircle
    });

    // Animate sprite previews (assume 3x3, first 7 frames)
    avatarChoices.forEach(choice => {
      const img = choice.querySelector('img');
      if (!img) return;
      const sheet = new Image();
      sheet.src = img.getAttribute('src');

      const canvas = document.createElement('canvas');
      canvas.width = 60;
      canvas.height = 60;
      canvas.style.imageRendering = 'pixelated';
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      img.replaceWith(canvas);

      let frameIndex = 0;
      const cols = 3, rows = 3, totalFrames = 7, frameMs = 180;

      function drawFrame() {
        if (!sheet.complete || !sheet.naturalWidth) return;
        const fw = sheet.naturalWidth / cols;
        const fh = sheet.naturalHeight / rows;
        const col = frameIndex % cols;
        const row = Math.floor(frameIndex / cols);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sheet, col * fw, row * fh, fw, fh, 0, 0, canvas.width, canvas.height);
      }

      setInterval(() => {
        frameIndex = (frameIndex + 1) % totalFrames;
        drawFrame();
      }, frameMs);

      sheet.onload = drawFrame;
    });

    // Handle character selection
    avatarChoices.forEach((choice) => {
      choice.addEventListener('click', function() {
        avatarChoices.forEach(c => c.classList.remove('active'));
        this.classList.add('active');

        const avatar = this.dataset.avatar; // PNG spritesheet path
        const characterType = this.dataset.type;
        
        console.log('🎭 Character clicked:', characterType);
        console.log('🖼️ Avatar path:', avatar);
        
        if (selectedAvatarInput) selectedAvatarInput.value = avatar;
        if (selectedCharacterTypeInput) selectedCharacterTypeInput.value = characterType;
        
        console.log('✅ Hidden inputs updated:', {
          avatar: selectedAvatarInput?.value,
          characterType: selectedCharacterTypeInput?.value
        });

        if (profileCircle) {
          const profileImagePath = `/images/characters/${characterType}.jpg`;
          profileCircle.style.backgroundImage = `url('${profileImagePath}')`;
        }
      });
    });

    // Set initial active avatar
    if (avatarChoices[0]) avatarChoices[0].classList.add('active');
    if (profileCircle) {
      profileCircle.style.backgroundImage = `url('/images/characters/knight.jpg')`;
    }

    // Handle form submission with visual feedback
    const selectCharacterBtn = document.getElementById('selectCharacterBtn');
    const form = document.querySelector('.selection-form');

    console.log('🔍 Form element found:', !!form);
    console.log('🔍 Button element found:', !!selectCharacterBtn);

    if (form) {
      console.log('✅ Form found - will use normal submission');
      // Just let the form submit normally - it's more reliable
      // The server will handle the redirect to /game
    }
  }
});


