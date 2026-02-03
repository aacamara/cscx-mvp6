/**
 * Social Mention Types (PRD-019)
 *
 * Type definitions for social mention sentiment tracking.
 */
export const DEFAULT_CSV_FIELD_MAPPINGS = {
    platform: ['platform', 'network', 'source', 'channel', 'social_network'],
    author: ['author', 'user', 'name', 'author_name', 'user_name', 'from', 'sender'],
    author_handle: ['handle', 'username', 'screen_name', 'author_handle', 'user_handle', '@handle'],
    followers: ['followers', 'follower_count', 'followers_count', 'audience_size'],
    verified: ['verified', 'is_verified', 'blue_check', 'verified_account'],
    content: ['content', 'text', 'message', 'post', 'tweet', 'body', 'mention_text'],
    date: ['date', 'timestamp', 'posted_at', 'created_at', 'time', 'post_date', 'published'],
    likes: ['likes', 'like_count', 'favorites', 'reactions', 'love'],
    shares: ['shares', 'retweets', 'reposts', 'share_count', 'rt_count'],
    comments: ['comments', 'replies', 'reply_count', 'comment_count', 'responses'],
    reach: ['reach', 'impressions', 'views', 'potential_reach', 'exposure'],
    url: ['url', 'link', 'post_url', 'permalink', 'source_url'],
};
//# sourceMappingURL=socialMention.js.map