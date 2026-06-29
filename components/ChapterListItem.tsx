/**
 * Chapter list item — compact row with number, play/download actions
 */

import React from 'react';
import {
   View,
   Text,
   StyleSheet,
   TouchableOpacity,
   Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chapter } from '@/services/audiobooks';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { formatDuration } from '@/utils/duration';
import { canAccessChapter } from '@/utils/chapterAccess';

interface ChapterListItemProps {
   chapter: Chapter;
   onPress: (chapter: Chapter) => void;
   isCurrentlyPlaying?: boolean;
   isActive?: boolean;
   progressSeconds?: number;
   showResumeBadge?: boolean;
   onDownloadPress?: (chapter: Chapter) => void;
   onCommentsPress?: (chapter: Chapter) => void;
}

export const ChapterListItem: React.FC<ChapterListItemProps> = React.memo(
   ({
      chapter,
      onPress,
      isCurrentlyPlaying = false,
      isActive = false,
      onDownloadPress,
   }) => {
      const { colors } = useTheme();
      const canInteract = canAccessChapter(chapter);
      const styles = useThemedStyles((t) =>
         StyleSheet.create({
            container: {
               flexDirection: 'row',
               alignItems: 'center',
               paddingVertical: spacing.md,
               paddingHorizontal: spacing.md,
               paddingLeft: spacing.md + 4,
               backgroundColor: t.colors.background.screen,
               position: 'relative',
            },
            containerActive: {
               backgroundColor: t.colors.background.highlight,
            },
            containerInactive: {
               opacity: 0.55,
            },
            divider: {
               height: 1,
               backgroundColor: t.colors.background.highlight,
               marginLeft: spacing.md,
            },
            activeBar: {
               position: 'absolute',
               left: 0,
               top: spacing.sm,
               bottom: spacing.sm,
               width: 3,
               backgroundColor: t.colors.accent.primary,
               borderRadius: 2,
            },
            chapterNumber: {
               width: 28,
               fontSize: typography.fontSize.sm,
               fontWeight: '600',
               color: t.colors.text.muted,
               textAlign: 'center',
               marginRight: spacing.sm,
            },
            chapterNumberInactive: {
               color: t.colors.text.secondary,
            },
            infoContainer: {
               flex: 1,
               marginRight: spacing.sm,
            },
            title: {
               fontSize: typography.fontSize.base,
               fontWeight: '500',
               color: t.colors.text.primary,
               marginBottom: 2,
               ...Platform.select({
                  ios: { fontFamily: 'System', fontWeight: '500' },
                  android: { fontFamily: 'sans-serif-medium' },
               }),
            },
            titleActive: {
               fontWeight: '600',
               color: t.colors.accent.primaryDark,
            },
            titleInactive: {
               color: t.colors.text.secondary,
            },
            duration: {
               fontSize: typography.fontSize.xs,
               color: t.colors.text.secondary,
            },
            durationInactive: {
               color: t.colors.text.muted,
            },
            actions: {
               flexDirection: 'row',
               alignItems: 'center',
               gap: spacing.sm,
            },
            actionButton: {
               padding: spacing.xs,
            },
            playButton: {
               width: 32,
               height: 32,
               borderRadius: 16,
               backgroundColor: t.colors.accent.primary,
               alignItems: 'center',
               justifyContent: 'center',
            },
            playButtonLocked: {
               backgroundColor: t.colors.background.input,
            },
            playIconOffset: {
               marginLeft: 2,
            },
         })
      );

      const formattedDuration = formatDuration(chapter.duration);
      const isHighlighted = canInteract && (isActive || isCurrentlyPlaying);

      return (
         <View>
            <TouchableOpacity
               style={[
                  styles.container,
                  isHighlighted && styles.containerActive,
                  !canInteract && styles.containerInactive,
               ]}
               onPress={canInteract ? () => onPress(chapter) : undefined}
               activeOpacity={canInteract ? 0.7 : 1}
               disabled={!canInteract}
               accessibilityState={{ disabled: !canInteract }}
            >
               {isHighlighted && <View style={styles.activeBar} />}

               <Text
                  style={[
                     styles.chapterNumber,
                     !canInteract && styles.chapterNumberInactive,
                  ]}
               >
                  {chapter.chapterNumber}
               </Text>

               <View style={styles.infoContainer}>
                  <Text
                     style={[
                        styles.title,
                        isHighlighted && styles.titleActive,
                        !canInteract && styles.titleInactive,
                     ]}
                     numberOfLines={1}
                  >
                     {chapter.title}
                  </Text>
                  <Text
                     style={[
                        styles.duration,
                        !canInteract && styles.durationInactive,
                     ]}
                  >
                     {formattedDuration}
                  </Text>
               </View>

               <View style={styles.actions} pointerEvents={canInteract ? 'auto' : 'none'}>
                  {canInteract && onDownloadPress && (
                     <TouchableOpacity
                        style={styles.actionButton}
                        onPress={(e) => {
                           e.stopPropagation?.();
                           onDownloadPress(chapter);
                        }}
                        activeOpacity={0.7}
                     >
                        <Ionicons
                           name="download-outline"
                           size={20}
                           color={colors.accent.primary}
                        />
                     </TouchableOpacity>
                  )}
                  {canInteract ? (
                     <TouchableOpacity
                        style={styles.playButton}
                        onPress={(e) => {
                           e.stopPropagation?.();
                           onPress(chapter);
                        }}
                        activeOpacity={0.8}
                     >
                        <Ionicons
                           name={isCurrentlyPlaying ? 'pause' : 'play'}
                           size={14}
                           color="#FFFFFF"
                           style={
                              !isCurrentlyPlaying ? styles.playIconOffset : undefined
                           }
                        />
                     </TouchableOpacity>
                  ) : (
                     <View style={[styles.playButton, styles.playButtonLocked]}>
                        <Ionicons
                           name="lock-closed"
                           size={14}
                           color={colors.text.muted}
                        />
                     </View>
                  )}
               </View>
            </TouchableOpacity>
            <View style={styles.divider} />
         </View>
      );
   }
);

ChapterListItem.displayName = 'ChapterListItem';
