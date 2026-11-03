package io.github.coyotewolf.aoi;

import io.github.coyotewolf.aoi.config.AssistantConfig;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.ModLoadingContext;
import net.minecraftforge.fml.config.ModConfig;

@Mod(AoiAssistantMod.ID)
public final class AoiAssistantMod {
 public static final String ID="aoi_assistant";
 public AoiAssistantMod(){ModLoadingContext.get().registerConfig(ModConfig.Type.CLIENT,AssistantConfig.SPEC);}
}
