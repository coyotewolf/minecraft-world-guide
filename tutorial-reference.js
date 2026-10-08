export function tutorialReference(article,{h,image,tutorialText,renderRecipe}){
 const references=(article.referenceSections||[]).map(section=>`<section class="tutorial-reference"><h2>${h(section.title)}</h2><div class="tutorial-reference-grid">${section.rows.map(row=>`<article class="tutorial-reference-card"><div class="tutorial-reference-heading">${row.item?`<button class="tutorial-reference-icon" data-recipe="${h(row.item)}" aria-label="${h(row.title)}，查看配方" data-item-hint="${h(row.title)}">${image(row.item)}</button>`:''}<h3>${h(row.title)}</h3></div><p>${tutorialText(row.text,article)}</p>${row.recipe?`<button data-recipe="${h(row.item)}">查看合成格位</button>`:''}</article>`).join('')}</div></section>`).join('');
 const recipes=(article.recipeSections||[]).map(section=>`<section class="tutorial-reference tutorial-recipe-section"><h2>${h(section.title)}</h2>${section.text?`<p>${tutorialText(section.text,article)}</p>`:''}${section.recipes.map(recipe=>`<div class="tutorial-recipe-example"><h3>${h(recipe.title)}</h3>${renderRecipe(recipe.raw)}</div>`).join('')}</section>`).join('');
 return references+recipes;
}
export function tutorialSourceFiles(article,{h}){
 const files=[...(article.sourceFiles||[]),...(article.unpackedSources||[])];
 return files.length?`<p>本機解包查覈：${h(article.unpackedAt||'2026-10-06')}</p><ul class="tutorial-source-files">${files.slice(0,24).map(file=>`<li>${h(file)}</li>`).join('')}</ul>${files.length>24?`<p>另含 ${files.length-24} 個相關資源檔，完整清單保存於教學資料。</p>`:''}`:'';
}
