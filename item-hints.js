// Hover and keyboard focus last until leave/blur; touch hints last only while held.
(()=>{
 const selector='[data-item-hint]';let target=null,tip=null,holdTimer=null,press=null,suppressed=null,lastInput='mouse';
 function hide(){clearTimeout(holdTimer);holdTimer=null;if(tip){if(tip.hidePopover&&tip.matches(':popover-open'))tip.hidePopover();tip.remove();tip=null}if(target){const ids=(target.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!=='inventory-hint');if(ids.length)target.setAttribute('aria-describedby',ids.join(' '));else target.removeAttribute('aria-describedby')}target=null}
 function show(el){hide();if(!el?.isConnected)return;target=el;tip=document.createElement('div');tip.id='inventory-hint';tip.className='inventory-hint';tip.setAttribute('role','tooltip');tip.textContent=el.dataset.itemHint;tip.setAttribute('popover','manual');(el.closest('dialog[open]')||document.body).append(tip);if(tip.showPopover)tip.showPopover();el.setAttribute('aria-describedby',((el.getAttribute('aria-describedby')||'')+' inventory-hint').trim());const r=el.getBoundingClientRect(),t=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-t.width-8,r.left+r.width/2-t.width/2))+'px';tip.style.top=Math.max(8,r.top-t.height-9<8?Math.min(innerHeight-t.height-8,r.bottom+9):r.top-t.height-9)+'px'}
 document.addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;lastInput='mouse';const el=e.target.closest(selector);if(el&&el!==target)show(el)});
 document.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const el=e.target.closest(selector);if(el&&!el.contains(e.relatedTarget))hide()});
 document.addEventListener('pointerdown',e=>{lastInput=e.pointerType;if(e.pointerType==='mouse'||e.button!==0)return;hide();const el=e.target.closest(selector);if(!el)return;press={el,id:e.pointerId,x:e.clientX,y:e.clientY,held:false};holdTimer=setTimeout(()=>{if(!press)return;press.held=true;show(el)},450)},true);
 document.addEventListener('pointermove',e=>{if(press&&e.pointerId===press.id&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10){press=null;hide()}},true);
 document.addEventListener('pointerup',e=>{if(!press||press.id!==e.pointerId)return;if(press.held){suppressed=press.el;setTimeout(()=>{suppressed=null},1000)}press=null;hide()},true);
 document.addEventListener('pointercancel',()=>{press=null;hide()},true);
 document.addEventListener('click',e=>{if(suppressed&&(e.target===suppressed||suppressed.contains(e.target))){suppressed=null;e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('contextmenu',e=>{if(e.target.closest(selector))e.preventDefault()});
 document.addEventListener('keydown',e=>{if(e.key==='Tab')lastInput='keyboard';if(e.key==='Escape'){press=null;hide()}});
 document.addEventListener('focusin',e=>{const el=e.target.closest(selector);if(el&&lastInput==='keyboard')show(el)});
 document.addEventListener('focusout',e=>{if(e.target.closest(selector)===target)hide()});
 document.addEventListener('close',hide,true);addEventListener('hashchange',hide);addEventListener('scroll',()=>{press=null;hide()},true);addEventListener('resize',hide);addEventListener('blur',()=>{press=null;hide()});
 new MutationObserver(()=>{if(target&&!target.isConnected)hide()}).observe(document.body,{childList:true,subtree:true});
})();
