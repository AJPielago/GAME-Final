  function drawCodingTerminal() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Terminal dimensions
    const termWidth = Math.min(700, canvas.width - 60);
    const termHeight = 450;
    const termX = (canvas.width - termWidth) / 2;
    const termY = (canvas.height - termHeight) / 2;
    
    // Terminal background (dark like VS Code)
    ctx.fillStyle = 'rgba(30, 30, 30, 0.98)';
    ctx.fillRect(termX, termY, termWidth, termHeight);
    
    // Terminal border
    ctx.strokeStyle = '#4A90E2';
    ctx.lineWidth = 3;
    ctx.strokeRect(termX, termY, termWidth, termHeight);
    
    // Title bar
    ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
    ctx.fillRect(termX, termY, termWidth, 35);
    ctx.fillStyle = '#4A90E2';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`💻 ${currentChallenge.title}`, termX + 15, termY + 23);
    
    // Description area
    const descY = termY + 50;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    
    // Word wrap description
    const words = currentChallenge.description.split(' ');
    let line = '';
    let y = descY;
    const maxWidth = termWidth - 40;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, termX + 20, y);
        line = words[i] + ' ';
        y += 18;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, termX + 20, y);
    
    // Code editor area
    const editorY = termY + 120;
    const editorHeight = 200;
    
    // Editor background
    ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
    ctx.fillRect(termX + 15, editorY, termWidth - 30, editorHeight);
    
    // Editor border
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.strokeRect(termX + 15, editorY, termWidth - 30, editorHeight);
    
    // Line numbers and code
    ctx.font = '13px monospace';
    const codeLines = currentChallenge.code.split('\n');
    let codeY = editorY + 25;
    
    for (let i = 0; i < codeLines.length; i++) {
      // Line number
      ctx.fillStyle = '#666666';
      ctx.textAlign = 'right';
      ctx.fillText((i + 1).toString(), termX + 40, codeY);
      
      // Code line
      ctx.fillStyle = '#D4D4D4';
      ctx.textAlign = 'left';
      ctx.fillText(codeLines[i], termX + 50, codeY);
      
      codeY += 18;
    }
    
    // Output area
    const outputY = editorY + editorHeight + 15;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OUTPUT:', termX + 20, outputY);
    
    // Output text
    ctx.fillStyle = '#00FF00';
    ctx.font = '12px monospace';
    let outY = outputY + 20;
    for (let i = 0; i < currentChallenge.output.length && i < 3; i++) {
      ctx.fillText(currentChallenge.output[i], termX + 20, outY);
      outY += 16;
    }
    
    // Buttons
    const buttonY = termY + termHeight - 50;
    const buttonHeight = 35;
    const buttonWidth = 120;
    
    // Run button
    const runX = termX + 20;
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(runX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 2;
    ctx.strokeRect(runX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('▶ Run Code', runX + buttonWidth/2, buttonY + 22);
    
    // Submit button
    const submitX = termX + buttonWidth + 40;
    ctx.fillStyle = '#3498db';
    ctx.fillRect(submitX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#5dade2';
    ctx.lineWidth = 2;
    ctx.strokeRect(submitX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('✓ Submit', submitX + buttonWidth/2, buttonY + 22);
    
    // Hint button
    const hintX = termX + buttonWidth * 2 + 60;
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(hintX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(hintX, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('💡 Hint', hintX + buttonWidth/2, buttonY + 22);
    
    // Show hint if requested
    if (currentChallenge.showHint) {
      ctx.fillStyle = '#f39c12';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Hint: ${currentChallenge.hint}`, termX + 20, buttonY - 10);
    }
    
    // Instructions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click in the code area to type. Press ESC to close.', termX + termWidth/2, termY + termHeight - 10);
  }
